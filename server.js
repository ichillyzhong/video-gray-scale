const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
const port = process.env.PORT || 8000;

// 安全头部设置
app.use(helmet({
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'", // 允许内联脚本
                "'unsafe-eval'", // 允许 WebAssembly 编译（FFmpeg.js 需要）
                "https://cdn.jsdelivr.net",
                "https://unpkg.com",
                "blob:" // 允许 blob URL 脚本（FFmpeg.js 需要）
            ],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: [
                "'self'",
                "https://cdn.jsdelivr.net",
                "https://unpkg.com",
                "blob:", // 允许连接到 blob URLs
                "data:" // 允许连接到 data URLs
            ],
            workerSrc: ["'self'", "blob:"],
            childSrc: ["'self'", "blob:"]
        }
    }
}));

// 启用压缩
app.use(compression());

// 根路径处理 - 明确返回 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'src'), {
    maxAge: '1d',
    etag: true,
    index: false // 禁用自动 index.html 查找，使用上面的明确路由
}));

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 处理
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// 错误处理
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// 启动服务器，处理端口冲突
const startServer = (port) => {
    const server = app.listen(port, () => {
        console.log(`服务器运行在 http://localhost:${port}/`);
        console.log('已启用 SharedArrayBuffer 支持');
        console.log(`静态文件目录: ${path.join(__dirname, 'src')}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`端口 ${port} 已被占用，尝试端口 ${port + 1}`);
            startServer(port + 1);
        } else {
            console.error('服务器启动失败:', err);
            process.exit(1);
        }
    });
};

startServer(port);