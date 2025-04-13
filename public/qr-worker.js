// public/qr-worker.js (前端Web Worker版本)
import QRCode from './lib/qrcode.js';

class QRProcessor {
  static generateQRMatrix(url, size) {
    const qr = new QRCode(0, 'H');
    qr.addData(url);
    qr.make();
    return {
      matrix: qr.modules,
      size: qr.getModuleCount()
    };
  }

  static mergeImages(baseData, qrData, width, height) {
    const output = new ImageData(width, height);
    const basePixels = new Uint32Array(baseData.buffer);
    const outputPixels = new Uint32Array(output.data.buffer);

    const qrSize = Math.min(width, height);
    const cellSize = qrSize / qrData.size;
    const alpha = 0.15; // 透明度调整系数

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const basePixel = basePixels[idx];
        
        // 转换为YUV颜色空间
        const r = (basePixel >> 16) & 0xff;
        const g = (basePixel >> 8) & 0xff;
        const b = basePixel & 0xff;
        const yuv = this.rgbToYuv(r, g, b);

        // 计算高频区域
        const isEdge = this.detectEdge(basePixels, x, y, width, height);
        
        // 在边缘区域嵌入二维码
        if (isEdge) {
          const qrX = Math.floor(x / cellSize);
          const qrY = Math.floor(y / cellSize);
          if (qrData.matrix[qrY]?.[qrX]) {
            yuv.y += qrData.matrix[qrY][qrX] ? 10 * alpha : -10 * alpha;
            yuv.y = Math.max(0, Math.min(255, yuv.y));
          }
        }

        // 转换回RGB
        const rgb = this.yuvToRgb(yuv.y, yuv.u, yuv.v);
        outputPixels[idx] = (0xff << 24) | 
          (Math.round(rgb.r) << 16) | 
          (Math.round(rgb.g) << 8) | 
          Math.round(rgb.b);
      }
    }
    return output;
  }

  static detectEdge(pixels, x, y, width, height) {
    if (x < 2 || y < 2 || x >= width-2 || y >= height-2) return false;
    
    // Sobel边缘检测
    let gx = 0, gy = 0;
    const kernel = [
      [-1, 0, 1], [-2, 0, 2], [-1, 0, 1],
      [-1,-2,-1], [0, 0, 0], [1, 2, 1]
    ];

    for (let ky = -1; ky <= 1; ky++) {
      for (let kx = -1; kx <= 1; kx++) {
        const idx = (y + ky) * width + (x + kx);
        const gray = this.getGrayScale(pixels[idx]);
        gx += gray * kernel[ky + 1][kx + 1];
        gy += gray * kernel[kx + 1][ky + 1];
      }
    }
    return Math.sqrt(gx*gx + gy*gy) > 64;
  }

  static getGrayScale(pixel) {
    const r = (pixel >> 16) & 0xff;
    const g = (pixel >> 8) & 0xff;
    const b = pixel & 0xff;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  static rgbToYuv(r, g, b) {
    return {
      y: 0.299 * r + 0.587 * g + 0.114 * b,
      u: -0.14713 * r - 0.28886 * g + 0.436 * b,
      v: 0.615 * r - 0.51499 * g - 0.10001 * b
    };
  }

  static yuvToRgb(y, u, v) {
    return {
      r: y + 1.13983 * v,
      g: y - 0.39465 * u - 0.58060 * v,
      b: y + 2.03211 * u
    };
  }
}

// Web Worker消息监听
self.addEventListener('message', async (e) => {
  try {
    const { url, imageData } = e.data;
    
    // 生成二维码矩阵
    const qrMatrix = QRProcessor.generateQRMatrix(url, 256);
    
    // 合并图像
    const output = QRProcessor.mergeImages(
      imageData.data, 
      qrMatrix,
      imageData.width, 
      imageData.height
    );

    self.postMessage(output, [output.data.buffer]);
  } catch (err) {
    self.postMessage({ error: err.message });
  }
});
