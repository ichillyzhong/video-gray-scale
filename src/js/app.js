// --- 初始化 WebGL 和 DOM 元素 ---
const canvas = document.getElementById('filterCanvas');
const gl = canvas.getContext('webgl');
const video = document.getElementById('inputVideo');
const processBtn = document.getElementById('processBtn');
const statusDiv = document.getElementById('status');
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ 
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

let videoDuration = 0;
const FPS = 30; // 目标视频帧率

// 检查 WebGL 是否可用
if (!gl) {
    alert('您的浏览器不支持 WebGL！');
}

// 顶点着色器 (Vertex Shader) - 定义绘制形状
const vertShaderSource = `
    attribute vec4 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = a_position;
        v_texCoord = a_texCoord;
    }
`;

// 片段着色器 (Fragment Shader) - 实现灰度滤镜
const fragShaderSource = `
    precision mediump float;
    uniform sampler2D u_image;
    varying vec2 v_texCoord;

    void main() {
        // 1. 获取原始像素颜色
        vec4 color = texture2D(u_image, v_texCoord);

        // 2. 计算灰度值 (加权平均法)
        float gray = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;

        // 3. 输出灰度颜色
        gl_FragColor = vec4(gray, gray, gray, color.a);
    }
`;

// --- WebGL 核心函数 ---

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader 编译错误:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function initWebGL() {
    const vertShader = createShader(gl, gl.VERTEX_SHADER, vertShaderSource);
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragShaderSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    gl.useProgram(program);

    // 绑定矩形顶点
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1, // 第一个三角形
        -1, 1, 1, -1, 1, 1   // 第二个三角形 (构成一个覆盖整个屏幕的矩形)
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // 绑定纹理坐标
    const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 1, 1, 1, 0, 0,
        0, 0, 1, 1, 1, 0
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // 创建纹理 (用于加载视频帧)
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return texture;
}

// 初始化 WebGL
const videoTexture = initWebGL();


// --- 事件处理 ---

// 1. 视频文件加载
document.getElementById('videoFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        video.src = url;
        statusDiv.textContent = '视频已加载，正在准备...';
        processBtn.disabled = true;

        // 确保视频元数据加载完毕，获取时长
        video.addEventListener('loadedmetadata', () => {
            videoDuration = video.duration;
            statusDiv.textContent = `视频加载完成。时长: ${videoDuration.toFixed(2)}s.`;
            processBtn.disabled = false;
        }, { once: true });
    }
});


// 2. 视频处理和编码
processBtn.addEventListener('click', async () => {
    processBtn.disabled = true;
    statusDiv.textContent = '初始化FFmpeg.js(首次加载可能较慢)...';
    
    // 加载 FFmpeg 核心模块
    if (!ffmpeg.isLoaded()) {
        try {
            await ffmpeg.load();
        } catch (error) {
            console.error('FFmpeg 加载失败:', error);
            statusDiv.textContent = 'FFmpeg 加载失败，请检查网络连接';
            processBtn.disabled = false;
            return;
        }
    }
    
    // 开始帧提取和处理
    await processAndEncodeVideo();
});


// --- 核心处理函数 ---

async function processAndEncodeVideo() {
    // 限制处理时长，避免太多帧
    const maxDuration = Math.min(videoDuration, 10); // 最多处理10秒
    const reducedFPS = 10; // 降低帧率以减少处理时间
    const totalFrames = Math.ceil(maxDuration * reducedFPS);
    
    statusDiv.textContent = `开始处理 ${totalFrames} 帧 (${maxDuration.toFixed(1)}秒)...`;
    
    // 1. 设置 FFmpeg 工作目录
    const outputFileName = 'output_grayscale.mp4';

    // 2. 帧提取、滤镜和写入文件系统
    let currentFrame = 0;
    const frameInterval = 1 / reducedFPS;

    // 调整 canvas 尺寸匹配视频
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    gl.viewport(0, 0, canvas.width, canvas.height);

    for (let time = 0; time < maxDuration; time += frameInterval) {
        // 2a. 设置视频播放时间
        video.currentTime = time;

        // 等待 seek 操作完成
        await new Promise(resolve => {
            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                resolve();
            };
            video.addEventListener('seeked', onSeeked);
            
            // 添加超时保护
            setTimeout(() => {
                video.removeEventListener('seeked', onSeeked);
                resolve();
            }, 1000);
        });

        // 2b. WebGL 滤镜处理
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // 将当前视频帧加载为 WebGL 纹理
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        
        // 执行绘制（应用着色器中的灰度滤镜）
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // 2c. 从 Canvas 提取处理后的像素数据并等待写入完成
        await new Promise((resolve) => {
            canvas.toBlob(async (blob) => {
                try {
                    const arrayBuffer = await blob.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    const fileName = `frame${currentFrame.toString().padStart(5, '0')}.png`;
                    ffmpeg.FS('writeFile', fileName, uint8Array);
                    console.log(`写入帧: ${fileName}`);
                    resolve();
                } catch (error) {
                    console.error(`写入帧 ${currentFrame} 失败:`, error);
                    resolve(); // 即使失败也继续
                }
            }, 'image/png');
        });

        currentFrame++;
        statusDiv.textContent = `正在处理并写入帧: ${currentFrame} / ${totalFrames}`;
        
        // 添加小延迟让浏览器有时间处理
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 等待所有帧写入完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. FFmpeg 重新编码和合成
    statusDiv.textContent = '所有帧已处理，开始 FFmpeg 编码合成...';

    try {
        // 先检查文件是否存在
        console.log('检查文件系统中的文件:');
        const files = ffmpeg.FS('readdir', '/');
        console.log('根目录文件:', files);
        
        // 检查帧文件数量
        const frameFiles = files.filter(f => f.startsWith('frame') && f.endsWith('.png'));
        console.log(`找到 ${frameFiles.length} 个帧文件，期望 ${totalFrames} 个`);
        
        if (frameFiles.length === 0) {
            throw new Error('没有找到任何帧文件');
        }
        
        // 简化的 FFmpeg 命令，先只处理视频不包含音频
        await ffmpeg.run(
            '-framerate', `${reducedFPS}`,
            '-i', 'frame%05d.png',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-y', // 覆盖输出文件
            outputFileName
        );

        statusDiv.textContent = '视频合成完成！';

        // 检查输出文件是否存在
        const outputFiles = ffmpeg.FS('readdir', '/');
        console.log('输出后的文件:', outputFiles);
        
        if (!outputFiles.includes(outputFileName)) {
            throw new Error('输出文件未生成');
        }

        // 4. 下载合成后的视频
        const data = ffmpeg.FS('readFile', outputFileName);
        const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
        
        const a = document.createElement('a');
        a.href = url;
        a.download = outputFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        processBtn.disabled = false;
        statusDiv.textContent = '处理成功，请检查下载文件。';
        
    } catch (error) {
        console.error('FFmpeg 处理错误:', error);
        statusDiv.textContent = `FFmpeg 处理失败: ${error.message}`;
        processBtn.disabled = false;
        return;
    }
}