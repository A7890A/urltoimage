export default {};

importScripts('./lib/qrcode.js');

class QRProcessor {
    static process({ url, imageData }) {
        const qrData = this.generateQRData(url, imageData.width, imageData.height);
        return this.hideQRInImage(imageData, qrData);
    }

    static generateQRData(url, width, height) {
        const qr = new QRCode(0, 'H');
        qr.addData(url);
        qr.make();

        const moduleCount = qr.getModuleCount();
        const cellSize = Math.max(2, Math.min(width, height) / moduleCount);
        const qrSize = moduleCount * cellSize;

        const canvas = new OffscreenCanvas(qrSize, qrSize);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // 绘制二维码（带静区）
        ctx.fillStyle = 'black';
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (qr.isDark(row, col)) {
                    ctx.fillRect(
                        col * cellSize,
                        row * cellSize,
                        cellSize,
                        cellSize
                    );
                }
            }
        }
        return ctx.getImageData(0, 0, qrSize, qrSize);
    }

    static hideQRInImage(baseData, qrData) {
        const output = new ImageData(baseData.width, baseData.height);
        const basePixels = new Uint32Array(baseData.data.buffer);
        const qrPixels = new Uint32Array(qrData.data.buffer);
        const outputPixels = new Uint32Array(output.data.buffer);
        
        const threshold = 50;
        const alpha = 0.1;

        for (let y = 0; y < baseData.height; y++) {
            for (let x = 0; x < baseData.width; x++) {
                const baseIdx = y * baseData.width + x;
                const qrX = Math.floor((x / baseData.width) * qrData.width);
                const qrY = Math.floor((y / baseData.height) * qrData.height);
                const qrIdx = qrY * qrData.width + qrX;
                
                const edgeValue = this.calculateEdgeValue(basePixels, x, y, baseData.width, baseData.height);
                const basePixel = basePixels[baseIdx];
                const qrValue = (qrPixels[qrIdx] & 0xff) > 128 ? 1 : 0;

                const newPixel = edgeValue > threshold ? 
                    this.applyQRModification(basePixel, qrValue, alpha) : 
                    basePixel;

                outputPixels[baseIdx] = newPixel;
            }
        }
        return output;
    }

    static calculateEdgeValue(pixels, x, y, width, height) {
        if (x < 1 || y < 1 || x >= width-1 || y >= height-1) return 0;
        
        const neighbors = [
            pixels[(y-1)*width + (x-1)], // top-left
            pixels[(y-1)*width + x],     // top
            pixels[(y-1)*width + (x+1)], // top-right
            pixels[y*width + (x-1)],     // left
            pixels[y*width + (x+1)],     // right
            pixels[(y+1)*width + (x-1)], // bottom-left
            pixels[(y+1)*width + x],     // bottom
            pixels[(y+1)*width + (x+1)]  // bottom-right
        ];

        const grayNeighbors = neighbors.map(p => 
            Math.round(0.299*((p >> 16) & 0xff) + 
            0.587*((p >> 8) & 0xff) + 
            0.114*(p & 0xff))
        );

        const gx = -grayNeighbors[0] + grayNeighbors[2] +
                   -2*grayNeighbors[3] + 2*grayNeighbors[4] +
                   -grayNeighbors[5] + grayNeighbors[7];
        
        const gy = -grayNeighbors[0] - 2*grayNeighbors[1] - grayNeighbors[2] +
                   grayNeighbors[5] + 2*grayNeighbors[6] + grayNeighbors[7];
        
        return Math.sqrt(gx*gx + gy*gy);
    }

    static applyQRModification(pixel, qrValue, alpha) {
        const r = (pixel >> 16) & 0xff;
        const g = (pixel >> 8) & 0xff;
        const b = pixel & 0xff;
        
        const yuv = this.rgbToYuv(r, g, b);
        const delta = qrValue ? 10 : -10;
        yuv.y = Math.min(255, Math.max(0, yuv.y + delta * alpha));
        
        const rgb = this.yuvToRgb(yuv.y, yuv.u, yuv.v);
        return (0xff000000) | 
               (Math.round(rgb.r) << 16) | 
               (Math.round(rgb.g) << 8) | 
               Math.round(rgb.b);
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

self.addEventListener('message', ({ data }) => {
    try {
        const result = QRProcessor.process(data);
        self.postMessage(result, [result.data.buffer]);
    } catch (err) {
        self.postMessage({ error: err.message });
    }
});
