# 技术设计文档 (TDD)
# WebGL 灰度滤镜与视频合成工具

## 1. 技术架构概述

### 1.1 整体架构
```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器环境                              │
├─────────────────────────────────────────────────────────────┤
│  用户界面层 (UI Layer)                                        │
│  ├── HTML5 (index.html)                                    │
│  ├── CSS3 样式                                              │
│  └── 用户交互控制                                            │
├─────────────────────────────────────────────────────────────┤
│  应用逻辑层 (Application Layer)                               │
│  ├── 事件处理 (Event Handlers)                              │
│  ├── 状态管理 (State Management)                            │
│  └── 流程控制 (Process Control)                             │
├─────────────────────────────────────────────────────────────┤
│  处理引擎层 (Processing Layer)                                │
│  ├── WebGL 渲染引擎                                          │
│  ├── 视频帧提取器                                            │
│  └── FFmpeg.js 编码器                                       │
├─────────────────────────────────────────────────────────────┤
│  浏览器 API 层 (Browser API Layer)                           │
│  ├── File API (文件处理)                                     │
│  ├── Canvas API (图像处理)                                   │
│  ├── Video API (视频播放)                                    │
│  └── WebGL API (GPU 加速)                                   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈选择

| 技术 | 版本 | 用途 | 选择理由 |
|------|------|------|----------|
| WebGL | 1.0 | GPU 图像处理 | 硬件加速，性能优异 |
| FFmpeg.js | 0.11.6 | 视频编解码 | 功能完整，浏览器兼容性好 |
| HTML5 Video | - | 视频播放控制 | 原生支持，API 丰富 |
| Canvas API | - | 图像数据提取 | 标准 API，兼容性好 |
| ES6+ | - | 应用逻辑 | 现代语法，异步处理 |

## 2. 核心模块设计

### 2.1 WebGL 渲染模块

#### 2.1.1 着色器设计
```glsl
// 顶点着色器 (Vertex Shader)
attribute vec4 a_position;    // 顶点位置
attribute vec2 a_texCoord;    // 纹理坐标
varying vec2 v_texCoord;      // 传递给片段着色器的纹理坐标

void main() {
    gl_Position = a_position;
    v_texCoord = a_texCoord;
}

// 片段着色器 (Fragment Shader)
precision mediump float;
uniform sampler2D u_image;    // 输入纹理
varying vec2 v_texCoord;      // 从顶点着色器接收的纹理坐标

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    // 使用 ITU-R BT.709 标准的灰度转换公式
    float gray = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
    gl_FragColor = vec4(gray, gray, gray, color.a);
}
```

#### 2.1.2 渲染管线
```javascript
class WebGLRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');
        this.program = null;
        this.texture = null;
        this.init();
    }
    
    init() {
        // 1. 编译着色器
        // 2. 创建程序对象
        // 3. 设置顶点数据
        // 4. 创建纹理对象
    }
    
    render(videoElement) {
        // 1. 更新纹理数据
        // 2. 设置渲染状态
        // 3. 执行绘制调用
    }
}
```

### 2.2 视频处理模块

#### 2.2.1 帧提取器
```javascript
class FrameExtractor {
    constructor(video, canvas) {
        this.video = video;
        this.canvas = canvas;
        this.frameRate = 10; // 目标帧率
    }
    
    async extractFrames(duration) {
        const frames = [];
        const interval = 1 / this.frameRate;
        
        for (let time = 0; time < duration; time += interval) {
            const frame = await this.extractFrameAt(time);
            frames.push(frame);
        }
        
        return frames;
    }
    
    async extractFrameAt(time) {
        return new Promise((resolve) => {
            this.video.currentTime = time;
            this.video.addEventListener('seeked', () => {
                // WebGL 渲染
                // Canvas 数据提取
                resolve(frameData);
            }, { once: true });
        });
    }
}
```

#### 2.2.2 FFmpeg 编码器
```javascript
class VideoEncoder {
    constructor() {
        this.ffmpeg = createFFmpeg({ log: true });
        this.loaded = false;
    }
    
    async init() {
        if (!this.loaded) {
            await this.ffmpeg.load();
            this.loaded = true;
        }
    }
    
    async encodeFrames(frames, options) {
        // 1. 写入帧文件到虚拟文件系统
        // 2. 执行 FFmpeg 命令
        // 3. 读取输出文件
        // 4. 返回视频数据
    }
}
```

## 3. 数据流设计

### 3.1 处理流程
```
用户上传视频
    ↓
加载视频元数据
    ↓
初始化 WebGL 上下文
    ↓
逐帧处理循环:
    ├── 设置视频时间点
    ├── 等待 seeked 事件
    ├── WebGL 渲染灰度效果
    ├── 提取 Canvas 数据
    └── 写入 FFmpeg 文件系统
    ↓
执行 FFmpeg 编码
    ↓
生成输出视频
    ↓
触发下载
```

### 3.2 状态管理
```javascript
const AppState = {
    IDLE: 'idle',                    // 空闲状态
    LOADING_VIDEO: 'loading_video',  // 加载视频
    VIDEO_READY: 'video_ready',      // 视频就绪
    PROCESSING: 'processing',        // 处理中
    ENCODING: 'encoding',            // 编码中
    COMPLETED: 'completed',          // 完成
    ERROR: 'error'                   // 错误
};

class StateManager {
    constructor() {
        this.state = AppState.IDLE;
        this.listeners = [];
    }
    
    setState(newState, data = null) {
        this.state = newState;
        this.notifyListeners(newState, data);
    }
    
    notifyListeners(state, data) {
        this.listeners.forEach(listener => listener(state, data));
    }
}
```

## 4. 性能优化策略

### 4.1 内存管理
```javascript
class MemoryManager {
    constructor() {
        this.allocatedTextures = [];
        this.allocatedBuffers = [];
    }
    
    // 纹理对象池
    getTexture() {
        return this.allocatedTextures.pop() || this.createTexture();
    }
    
    releaseTexture(texture) {
        this.allocatedTextures.push(texture);
    }
    
    // 清理资源
    cleanup() {
        this.allocatedTextures.forEach(texture => {
            gl.deleteTexture(texture);
        });
        this.allocatedBuffers.forEach(buffer => {
            gl.deleteBuffer(buffer);
        });
    }
}
```

### 4.2 异步处理优化
```javascript
// 使用 Web Workers 进行数据处理
class WorkerPool {
    constructor(workerScript, poolSize = 4) {
        this.workers = [];
        this.taskQueue = [];
        this.busyWorkers = new Set();
        
        for (let i = 0; i < poolSize; i++) {
            this.workers.push(new Worker(workerScript));
        }
    }
    
    async execute(task) {
        return new Promise((resolve, reject) => {
            this.taskQueue.push({ task, resolve, reject });
            this.processQueue();
        });
    }
    
    processQueue() {
        if (this.taskQueue.length === 0) return;
        
        const availableWorker = this.workers.find(w => !this.busyWorkers.has(w));
        if (!availableWorker) return;
        
        const { task, resolve, reject } = this.taskQueue.shift();
        this.busyWorkers.add(availableWorker);
        
        availableWorker.postMessage(task);
        availableWorker.onmessage = (e) => {
            this.busyWorkers.delete(availableWorker);
            resolve(e.data);
            this.processQueue();
        };
    }
}
```

## 5. 错误处理设计

### 5.1 错误分类
```javascript
class AppError extends Error {
    constructor(type, message, details = null) {
        super(message);
        this.type = type;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

const ErrorTypes = {
    WEBGL_NOT_SUPPORTED: 'webgl_not_supported',
    VIDEO_LOAD_FAILED: 'video_load_failed',
    FFMPEG_LOAD_FAILED: 'ffmpeg_load_failed',
    PROCESSING_FAILED: 'processing_failed',
    ENCODING_FAILED: 'encoding_failed',
    OUT_OF_MEMORY: 'out_of_memory'
};
```

### 5.2 错误恢复策略
```javascript
class ErrorHandler {
    constructor() {
        this.retryCount = new Map();
        this.maxRetries = 3;
    }
    
    async handleError(error, context) {
        console.error(`Error in ${context}:`, error);
        
        switch (error.type) {
            case ErrorTypes.WEBGL_NOT_SUPPORTED:
                return this.fallbackToCanvas();
                
            case ErrorTypes.FFMPEG_LOAD_FAILED:
                return this.retryFFmpegLoad();
                
            case ErrorTypes.OUT_OF_MEMORY:
                return this.reduceQuality();
                
            default:
                return this.showUserError(error);
        }
    }
    
    async retryOperation(operation, context) {
        const count = this.retryCount.get(context) || 0;
        
        if (count >= this.maxRetries) {
            throw new AppError('MAX_RETRIES_EXCEEDED', 
                `Operation ${context} failed after ${this.maxRetries} retries`);
        }
        
        this.retryCount.set(context, count + 1);
        
        // 指数退避
        await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, count) * 1000));
        
        return operation();
    }
}
```

## 6. 安全性设计

### 6.1 输入验证
```javascript
class InputValidator {
    static validateVideoFile(file) {
        const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
        const maxSize = 100 * 1024 * 1024; // 100MB
        
        if (!allowedTypes.includes(file.type)) {
            throw new AppError('INVALID_FILE_TYPE', 
                'Only MP4, WebM, and OGG files are supported');
        }
        
        if (file.size > maxSize) {
            throw new AppError('FILE_TOO_LARGE', 
                'File size must be less than 100MB');
        }
        
        return true;
    }
    
    static validateDuration(duration) {
        const maxDuration = 600; // 10 minutes
        
        if (duration > maxDuration) {
            throw new AppError('DURATION_TOO_LONG', 
                'Video duration must be less than 10 minutes');
        }
        
        return true;
    }
}
```

### 6.2 资源限制
```javascript
class ResourceLimiter {
    constructor() {
        this.maxConcurrentProcesses = 1;
        this.maxMemoryUsage = 2 * 1024 * 1024 * 1024; // 2GB
        this.currentProcesses = 0;
    }
    
    async acquireResource() {
        if (this.currentProcesses >= this.maxConcurrentProcesses) {
            throw new AppError('RESOURCE_LIMIT_EXCEEDED', 
                'Too many concurrent processes');
        }
        
        if (this.getMemoryUsage() > this.maxMemoryUsage) {
            throw new AppError('MEMORY_LIMIT_EXCEEDED', 
                'Memory usage too high');
        }
        
        this.currentProcesses++;
    }
    
    releaseResource() {
        this.currentProcesses = Math.max(0, this.currentProcesses - 1);
    }
    
    getMemoryUsage() {
        return performance.memory ? performance.memory.usedJSHeapSize : 0;
    }
}
```

## 7. 测试策略

### 7.1 单元测试
```javascript
// WebGL 渲染器测试
describe('WebGLRenderer', () => {
    let renderer;
    let mockCanvas;
    
    beforeEach(() => {
        mockCanvas = createMockCanvas();
        renderer = new WebGLRenderer(mockCanvas);
    });
    
    test('should initialize WebGL context', () => {
        expect(renderer.gl).toBeDefined();
        expect(renderer.program).toBeDefined();
    });
    
    test('should render grayscale effect', () => {
        const mockVideo = createMockVideo();
        renderer.render(mockVideo);
        
        // 验证渲染结果
        const pixels = new Uint8Array(4);
        renderer.gl.readPixels(0, 0, 1, 1, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixels);
        
        // 验证灰度值
        expect(pixels[0]).toBe(pixels[1]);
        expect(pixels[1]).toBe(pixels[2]);
    });
});
```

### 7.2 集成测试
```javascript
// 端到端处理流程测试
describe('Video Processing Pipeline', () => {
    test('should process video end-to-end', async () => {
        const mockVideoFile = createMockVideoFile();
        const processor = new VideoProcessor();
        
        const result = await processor.processVideo(mockVideoFile);
        
        expect(result).toBeDefined();
        expect(result.type).toBe('video/mp4');
        expect(result.size).toBeGreaterThan(0);
    });
});
```

### 7.3 性能测试
```javascript
// 性能基准测试
describe('Performance Benchmarks', () => {
    test('should process 10-second video within time limit', async () => {
        const startTime = performance.now();
        
        await processTestVideo('10s-test-video.mp4');
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        
        // 处理时间应该小于视频时长的3倍
        expect(processingTime).toBeLessThan(30000); // 30 seconds
    });
});
```

## 8. 部署架构

### 8.1 静态文件服务
```javascript
// server.js - 生产环境服务器配置
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');

const app = express();

// 安全头部
app.use(helmet({
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// 压缩
app.use(compression());

// 静态文件服务
app.use(express.static('public', {
    maxAge: '1d',
    etag: true
}));

// 缓存策略
app.use('/assets', express.static('assets', {
    maxAge: '1y',
    immutable: true
}));
```

### 8.2 CDN 配置
```yaml
# CDN 配置示例
cdn_config:
  origins:
    - domain: app.example.com
      path: /
  
  cache_behaviors:
    - path: "*.js"
      ttl: 86400  # 1 day
      compress: true
    
    - path: "*.wasm"
      ttl: 604800  # 1 week
      compress: false
    
    - path: "*.html"
      ttl: 3600   # 1 hour
      compress: true
```

## 9. 监控与日志

### 9.1 性能监控
```javascript
class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
    }
    
    startTimer(name) {
        this.metrics.set(name, performance.now());
    }
    
    endTimer(name) {
        const startTime = this.metrics.get(name);
        if (startTime) {
            const duration = performance.now() - startTime;
            this.reportMetric(name, duration);
            this.metrics.delete(name);
        }
    }
    
    reportMetric(name, value) {
        // 发送到分析服务
        if (window.gtag) {
            gtag('event', 'timing_complete', {
                name: name,
                value: Math.round(value)
            });
        }
    }
}
```

### 9.2 错误追踪
```javascript
class ErrorTracker {
    constructor() {
        this.setupGlobalErrorHandlers();
    }
    
    setupGlobalErrorHandlers() {
        window.addEventListener('error', (event) => {
            this.reportError({
                type: 'javascript_error',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.reportError({
                type: 'unhandled_promise_rejection',
                message: event.reason?.message || 'Unknown promise rejection',
                stack: event.reason?.stack
            });
        });
    }
    
    reportError(errorInfo) {
        // 发送错误报告到监控服务
        fetch('/api/errors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...errorInfo,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            })
        }).catch(console.error);
    }
}
```

## 10. 扩展性设计

### 10.1 插件架构
```javascript
class FilterPlugin {
    constructor(name, shaderSource) {
        this.name = name;
        this.shaderSource = shaderSource;
    }
    
    apply(renderer, params) {
        // 应用滤镜效果
    }
}

class PluginManager {
    constructor() {
        this.plugins = new Map();
    }
    
    register(plugin) {
        this.plugins.set(plugin.name, plugin);
    }
    
    apply(name, renderer, params) {
        const plugin = this.plugins.get(name);
        if (plugin) {
            return plugin.apply(renderer, params);
        }
        throw new Error(`Plugin ${name} not found`);
    }
}
```

### 10.2 配置系统
```javascript
class ConfigManager {
    constructor() {
        this.config = {
            processing: {
                maxDuration: 600,
                defaultFrameRate: 10,
                maxFileSize: 100 * 1024 * 1024
            },
            rendering: {
                maxTextureSize: 4096,
                enableMipmaps: false
            },
            ffmpeg: {
                logLevel: 'error',
                threads: 1
            }
        };
    }
    
    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.config);
    }
    
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => obj[key], this.config);
        target[lastKey] = value;
    }
}
```

这个 TDD 文档涵盖了项目的完整技术设计，包括架构设计、核心模块、数据流、性能优化、错误处理、安全性、测试策略、部署架构、监控日志和扩展性设计。