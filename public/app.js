class QRGenerator {
    constructor() {
        this.worker = new Worker('./qr-worker.js');
        this.initListeners();
        this.setupPerformanceMonitor();
    }

    initListeners() {
        document.getElementById('generateBtn').addEventListener('click', () => this.processImage());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadImage());
    }

    async processImage() {
        const url = document.getElementById('urlInput').value;
        const file = document.getElementById('imageInput').files[0];
        
        if (!this.validateInput(url, file)) return;

        try {
            this.showLoading(true);
            const img = await this.loadImage(file);
            const processedCanvas = await this.processCanvas(img);
            
            this.worker.postMessage({
                url,
                imageData: this.getImageData(processedCanvas)
            }, [processedCanvas.transferControlToOffscreen()]);

            this.worker.onmessage = (e) => {
                if (e.data.error) {
                    this.handleError(e.data.error);
                } else {
                    this.renderResult(e.data);
                }
                this.showLoading(false);
            };
        } catch (err) {
            this.handleError(err.message);
        }
    }

    validateInput(url, file) {
        if (!url || !file) {
            alert('请填写网址并选择图片');
            return false;
        }
        
        try {
            new URL(url);
        } catch {
            alert('网址格式无效');
            return false;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('图片大小不能超过5MB');
            return false;
        }

        return true;
    }

    async loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('图片加载失败'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsDataURL(file);
        });
    }

    processCanvas(img) {
        const MAX_SIZE = 2000;
        const canvas = new OffscreenCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        
        // 自动修正方向
        const orientation = this.getExifOrientation(img);
        this.applyOrientation(canvas, ctx, img, orientation);

        // 缩放处理
        const scale = Math.min(1, MAX_SIZE / Math.max(canvas.width, canvas.height));
        if (scale < 1) {
            const newCanvas = new OffscreenCanvas(canvas.width * scale, canvas.height * scale);
            newCanvas.getContext('2d').drawImage(canvas, 0, 0, newCanvas.width, newCanvas.height);
            return newCanvas;
        }
        
        return canvas;
    }

    getExifOrientation(img) {
        // EXIF方向检测逻辑（简版）
        return 1; // 完整实现需解析EXIF数据
    }

    applyOrientation(canvas, ctx, img, orientation) {
        // 方向校正逻辑
        ctx.drawImage(img, 0, 0);
    }

    getImageData(canvas) {
        return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    }

    renderResult(imageData) {
        const canvas = document.getElementById('outputCanvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        ctx.putImageData(imageData, 0, 0);
        document.getElementById('downloadBtn').disabled = false;
    }

    showLoading(visible) {
        document.querySelector('.loading').style.display = visible ? 'block' : 'none';
    }

    downloadImage() {
        const canvas = document.getElementById('outputCanvas');
        canvas.toBlob((blob) => {
            const link = document.createElement('a');
            link.download = `hidden-qr-${Date.now()}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
        }, 'image/png');
    }

    handleError(message) {
        alert(`错误: ${message}`);
        this.showLoading(false);
    }

    setupPerformanceMonitor() {
        if (navigator.deviceMemory) {
            console.log(`设备内存: ${navigator.deviceMemory}GB`);
        }
    }
}

new QRGenerator();
