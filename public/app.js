// app.js
class QRGenerator {
  constructor() {
    this.worker = new Worker(new URL('./qr-worker.js',import.meta.url){
        type:'module'
    });
    this.initEventListeners();
    this.setupDeviceCheck();
  }

  initEventListeners() {
    document.getElementById('generateBtn').addEventListener('click', () => this.processImage());
    document.getElementById('downloadBtn').addEventListener('click', () => this.downloadImage());
  }

  async processImage() {
    try {
      const [url, file] = this.validateInputs();
      this.showLoading(true);
      
      const img = await this.loadImage(file);
      const processedCanvas = await this.processImageCanvas(img);
      
      this.setupWorkerCommunication(processedCanvas, url);
    } catch (error) {
      this.handleError(error);
    }
  }

  validateInputs() {
    const url = document.getElementById('urlInput').value;
    const file = document.getElementById('imageInput').files[0];

    if (!url || !file) throw new Error('请填写网址并选择图片');
    if (!/^https?:\/\//i.test(url)) throw new Error('网址必须以http://或https://开头');
    if (file.size > 5 * 1024 * 1024) throw new Error('图片大小不能超过5MB');

    return [url, file];
  }

  async loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const img = await this.createImageWithOrientation(e.target.result, file);
          resolve(img);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  async createImageWithOrientation(dataURL, file) {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => resolve(this.fixImageOrientation(img, file));
      img.onerror = reject;
      img.src = dataURL;
    });
    return img;
  }

  async fixImageOrientation(img, file) {
    // 使用EXIF.js获取方向信息（需要额外加载exif.js）
    const orientation = await this.getExifOrientation(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 根据方向调整画布尺寸
    if (orientation >= 5 && orientation <= 8) {
      canvas.width = img.height;
      canvas.height = img.width;
    } else {
      canvas.width = img.width;
      canvas.height = img.height;
    }

    // 应用方向变换
    switch (orientation) {
      case 2: ctx.transform(-1, 0, 0, 1, img.width, 0); break;
      case 3: ctx.transform(-1, 0, 0, -1, img.width, img.height); break;
      case 4: ctx.transform(1, 0, 0, -1, 0, img.height); break;
      case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
      case 6: ctx.transform(0, 1, -1, 0, img.height, 0); break;
      case 7: ctx.transform(0, -1, -1, 0, img.height, img.width); break;
      case 8: ctx.transform(0, -1, 1, 0, 0, img.width); break;
    }

    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  async getExifOrientation(file) {
    // 简化的EXIF方向获取（完整实现需要EXIF.js）
    return new Promise(resolve => {
      if (!window.EXIF) return resolve(1);
      EXIF.getData(file, function() {
        resolve(EXIF.getTag(this, 'Orientation') || 1);
      });
    });
  }

  async processImageCanvas(img) {
    const MAX_DIMENSION = 2000;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const canvas = new OffscreenCanvas(
      Math.floor(img.width * scale),
      Math.floor(img.height * scale)
    );
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  setupWorkerCommunication(canvas, url) {
    const imageData = canvas.getContext('2d').getImageData(
      0, 0, canvas.width, canvas.height
    );

    this.worker.postMessage({ 
      url,
      imageData:Array.from(imageData.data),
      width: imageData.width,
      height: imageData.height
    }, [imageData.data.buffer]);

    this.worker.onmessage = (e) => {
      if (e.data.error) {
        this.handleError(e.data.error);
      } else {
        this.renderResult(e.data);
      }
      this.showLoading(false);
    };
  }

  renderResult(imageData) {
    const canvas = document.getElementById('outputCanvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.getContext('2d').putImageData(imageData, 0, 0);
    document.getElementById('downloadBtn').disabled = false;
  }

  downloadImage() {
    const canvas = document.getElementById('outputCanvas');
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hidden-qr-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 'image/png', 0.9);
  }

  showLoading(visible) {
    const loading = document.querySelector('.loading');
    loading.style.display = visible ? 'block' : 'none';
    if (visible) this.startProgressAnimation();
  }

  startProgressAnimation() {
    const progress = document.querySelector('.progress-bar');
    progress.style.transform = 'scaleX(0)';
    setTimeout(() => {
      progress.style.transition = 'transform 3s linear';
      progress.style.transform = 'scaleX(1)';
    }, 50);
  }

  setupDeviceCheck() {
    if (navigator.deviceMemory < 2) {
      console.warn('低内存设备检测');
      this.showMemoryWarning();
    }
  }

  showMemoryWarning() {
    const warning = document.createElement('div');
    warning.className = 'memory-warning';
    warning.innerHTML = `
      <p>您的设备内存较低，处理大图片时可能出现延迟</p>
      <button onclick="this.parentElement.remove()">知道了</button>
    `;
    document.body.prepend(warning);
  }

  handleError(error) {
    console.error('Error:', error);
    this.showLoading(false);
    alert(`操作失败: ${error.message}`);
  }
}

// 初始化应用
new QRGenerator();

// 注册Service Worker（可选）
/* if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker注册成功:', registration.scope);
      })
      .catch(err => {
        console.log('ServiceWorker注册失败:', err);
      });
  });
}*/
