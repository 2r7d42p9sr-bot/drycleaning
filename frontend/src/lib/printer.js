// WebUSB Thermal Printer Integration for ESC/POS printers

// ESC/POS Commands
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export const ESC_POS = {
  INIT: [ESC, 0x40], // Initialize printer
  CUT: [GS, 0x56, 0x00], // Full cut
  PARTIAL_CUT: [GS, 0x56, 0x01], // Partial cut
  FEED: [ESC, 0x64, 0x03], // Feed 3 lines
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  DOUBLE_WIDTH: [ESC, 0x21, 0x20],
  DOUBLE_SIZE: [ESC, 0x21, 0x30],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  UNDERLINE_ON: [ESC, 0x2d, 0x01],
  UNDERLINE_OFF: [ESC, 0x2d, 0x00],
  OPEN_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xfa], // Kick cash drawer
};

// Check if WebUSB is supported
export const isWebUSBSupported = () => {
  return 'usb' in navigator;
};

// Printer class for managing USB connection
export class ThermalPrinter {
  constructor() {
    this.device = null;
    this.interface = null;
    this.endpoint = null;
  }

  async connect() {
    if (!isWebUSBSupported()) {
      throw new Error("WebUSB is not supported in this browser");
    }

    try {
      // Request USB device - common thermal printer vendor IDs
      this.device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x0416 }, // Winbond (common for POS printers)
          { vendorId: 0x0483 }, // STMicroelectronics
          { vendorId: 0x04b8 }, // Epson
          { vendorId: 0x0519 }, // Star Micronics
          { vendorId: 0x0dd4 }, // Custom
          { vendorId: 0x154f }, // SNBC
          { vendorId: 0x0fe6 }, // ICS Advent
          { vendorId: 0x1504 }, // citizen
        ]
      });

      await this.device.open();
      
      // Select configuration
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }

      // Find printer interface
      const interfaces = this.device.configuration.interfaces;
      for (const iface of interfaces) {
        for (const alternate of iface.alternates) {
          if (alternate.interfaceClass === 7) { // Printer class
            this.interface = iface;
            break;
          }
        }
        if (this.interface) break;
      }

      if (!this.interface) {
        // Use first interface if no printer class found
        this.interface = interfaces[0];
      }

      await this.device.claimInterface(this.interface.interfaceNumber);

      // Find bulk out endpoint
      const alternate = this.interface.alternates[0];
      for (const endpoint of alternate.endpoints) {
        if (endpoint.direction === 'out' && endpoint.type === 'bulk') {
          this.endpoint = endpoint;
          break;
        }
      }

      return true;
    } catch (error) {
      console.error("Error connecting to printer:", error);
      throw error;
    }
  }

  async disconnect() {
    if (this.device) {
      try {
        await this.device.releaseInterface(this.interface.interfaceNumber);
        await this.device.close();
      } catch (e) {
        console.error("Error disconnecting:", e);
      }
      this.device = null;
      this.interface = null;
      this.endpoint = null;
    }
  }

  async write(data) {
    if (!this.device || !this.endpoint) {
      throw new Error("Printer not connected");
    }

    const buffer = new Uint8Array(data);
    await this.device.transferOut(this.endpoint.endpointNumber, buffer);
  }

  async print(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    await this.write([...data, LF]);
  }

  async printLine(text) {
    await this.print(text + "\n");
  }

  async init() {
    await this.write(ESC_POS.INIT);
  }

  async cut() {
    await this.write(ESC_POS.FEED);
    await this.write(ESC_POS.CUT);
  }

  async openCashDrawer() {
    await this.write(ESC_POS.OPEN_DRAWER);
  }

  async centerAlign() {
    await this.write(ESC_POS.ALIGN_CENTER);
  }

  async leftAlign() {
    await this.write(ESC_POS.ALIGN_LEFT);
  }

  async setBold(enabled) {
    await this.write(enabled ? ESC_POS.BOLD_ON : ESC_POS.BOLD_OFF);
  }

  async setDoubleSize(enabled) {
    await this.write(enabled ? ESC_POS.DOUBLE_SIZE : ESC_POS.NORMAL_SIZE);
  }
}

// Cash Drawer class
export class CashDrawer {
  constructor(printer) {
    this.printer = printer;
  }

  async open() {
    if (!this.printer || !this.printer.device) {
      throw new Error("Printer not connected - cash drawer requires printer connection");
    }
    await this.printer.openCashDrawer();
  }
}

// Receipt formatting helpers
export const formatReceipt = (order, businessInfo = {}) => {
  const {
    name = "DryClean POS",
    address = "",
    phone = "",
    taxRate = 0.08
  } = businessInfo;

  const divider = "-".repeat(40);
  const doubleDivider = "=".repeat(40);

  let receipt = [];
  
  // Header
  receipt.push({ text: name, align: "center", bold: true, size: "double" });
  if (address) receipt.push({ text: address, align: "center" });
  if (phone) receipt.push({ text: phone, align: "center" });
  receipt.push({ text: divider });
  
  // Order info
  receipt.push({ text: `Order: ${order.order_number}`, bold: true });
  receipt.push({ text: `Date: ${new Date(order.created_at).toLocaleString()}` });
  receipt.push({ text: `Customer: ${order.customer_name}` });
  receipt.push({ text: `Phone: ${order.customer_phone}` });
  receipt.push({ text: divider });
  
  // Items
  for (const item of order.items) {
    const serviceLabel = item.service_type !== "regular" ? ` (${item.service_type})` : "";
    receipt.push({ text: `${item.item_name}${serviceLabel}` });
    receipt.push({ text: `  ${item.quantity} x $${item.unit_price.toFixed(2)} = $${item.total_price.toFixed(2)}`, align: "right" });
  }
  
  receipt.push({ text: divider });
  
  // Totals
  receipt.push({ text: `Subtotal: $${order.subtotal.toFixed(2)}`, align: "right" });
  receipt.push({ text: `Tax: $${order.tax.toFixed(2)}`, align: "right" });
  if (order.discount > 0) {
    receipt.push({ text: `Discount: -$${order.discount.toFixed(2)}`, align: "right" });
  }
  receipt.push({ text: doubleDivider });
  receipt.push({ text: `TOTAL: $${order.total.toFixed(2)}`, align: "right", bold: true, size: "double" });
  
  // Footer
  receipt.push({ text: divider });
  if (order.estimated_ready) {
    receipt.push({ text: `Ready by: ${order.estimated_ready}`, align: "center" });
  }
  receipt.push({ text: "Thank you for your business!", align: "center" });
  
  return receipt;
};

// Garment label formatting
export const formatGarmentLabel = (order, item, index) => {
  return [
    { text: order.order_number, bold: true },
    { text: `${index + 1}/${order.items.length}` },
    { text: item.item_name },
    { text: item.service_type.toUpperCase() },
    { text: order.customer_name },
    { text: order.customer_phone },
    { text: order.estimated_ready || "" }
  ];
};

// Browser print fallback
export const browserPrintReceipt = (order, businessInfo = {}) => {
  const receiptData = formatReceipt(order, businessInfo);
  
  const printWindow = window.open('', '_blank', 'width=300,height=600');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt - ${order.order_number}</title>
      <style>
        body { 
          font-family: 'Courier New', monospace; 
          font-size: 12px; 
          width: 280px; 
          margin: 0 auto;
          padding: 10px;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .double { font-size: 16px; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
      </style>
    </head>
    <body>
      ${receiptData.map(line => {
        const classes = [
          line.align || '',
          line.bold ? 'bold' : '',
          line.size === 'double' ? 'double' : ''
        ].filter(Boolean).join(' ');
        
        if (line.text.includes('-'.repeat(10)) || line.text.includes('='.repeat(10))) {
          return '<div class="divider"></div>';
        }
        
        return `<div class="${classes}">${line.text}</div>`;
      }).join('')}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
};

// Browser print label fallback
export const browserPrintLabel = (order, item, index) => {
  const labelData = formatGarmentLabel(order, item, index);
  
  const printWindow = window.open('', '_blank', 'width=200,height=300');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Label - ${order.order_number}</title>
      <style>
        body { 
          font-family: 'Courier New', monospace; 
          font-size: 10px; 
          width: 2in; 
          margin: 0;
          padding: 4px;
        }
        .bold { font-weight: bold; }
        div { margin: 2px 0; }
      </style>
    </head>
    <body>
      ${labelData.map(line => 
        `<div class="${line.bold ? 'bold' : ''}">${line.text}</div>`
      ).join('')}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
};
