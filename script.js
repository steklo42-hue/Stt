class SpeechRecognitionApp {
    constructor() {
        this.apiKey = '';
        this.audioFile = null;
        this.recognizedText = '';
        
        this.initElements();
        this.bindEvents();
        this.loadApiKey();
    }
    
    initElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.audioInput = document.getElementById('audioFile');
        this.fileInfo = document.getElementById('fileInfo');
        this.processBtn = document.getElementById('processBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progressBar');
        this.status = document.getElementById('status');
        this.apiKeyInput = document.getElementById('apiKey');
    }
    
    bindEvents() {
        this.uploadArea.addEventListener('click', () => this.audioInput.click());
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        this.audioInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.processBtn.addEventListener('click', () => this.processAudio());
        this.downloadBtn.addEventListener('click', () => this.downloadDocx());
        this.apiKeyInput.addEventListener('input', (e) => this.saveApiKey(e.target.value));
    }
    
    loadApiKey() {
        const savedKey = localStorage.getItem('yandexApiKey');
        if (savedKey) {
            this.apiKeyInput.value = savedKey;
            this.apiKey = savedKey;
        }
    }
    
    saveApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('yandexApiKey', key);
    }
    
    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.style.borderColor = '#764ba2';
        this.uploadArea.style.background = '#eef2ff';
    }
    
    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.style.borderColor = '#667eea';
        this.uploadArea.style.background = '#f8f9fa';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleAudioFile(files[0]);
        }
    }
    
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleAudioFile(file);
        }
    }
    
    handleAudioFile(file) {
        // Проверка типа файла
        const validTypes = ['audio/wav', 'audio/m4a', 'audio/ogg', 'audio/mpeg', 'audio/flac', 'audio/x-m4a'];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const validExtensions = ['wav', 'm4a', 'ogg', 'mp3', 'flac'];
        
        if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
            this.showStatus('Неподдерживаемый формат файла', 'error');
            return;
        }
        
        // Проверка размера файла (10 МБ)
        if (file.size > 10 * 1024 * 1024) {
            this.showStatus('Файл слишком большой (макс. 10 МБ)', 'error');
            return;
        }
        
        this.audioFile = file;
        this.fileInfo.innerHTML = `
            <strong>Выбран файл:</strong> ${file.name}<br>
            <strong>Размер:</strong> ${(file.size / 1024 / 1024).toFixed(2)} МБ<br>
            <strong>Тип:</strong> ${file.type || 'audio/' + fileExtension}
        `;
        
        this.processBtn.disabled = !this.apiKey;
        this.downloadBtn.style.display = 'none';
        this.showStatus('Файл готов к обработке', 'success');
    }
    
    async processAudio() {
        if (!this.apiKey) {
            this.showStatus('Введите API-ключ Yandex Cloud', 'error');
            return;
        }
        
        if (!this.audioFile) {
            this.showStatus('Выберите аудиофайл', 'error');
            return;
        }
        
        this.showStatus('Подготовка файла...', 'processing');
        this.progressContainer.style.display = 'block';
        this.updateProgress(10);
        
        try {
            // Конвертируем файл в base64
            this.updateProgress(30);
            const audioBase64 = await this.fileToBase64(this.audioFile);
            
            // Определяем кодек
            const codec = this.detectCodec(this.audioFile);
            
            // Отправляем запрос на распознавание
            this.updateProgress(50);
            this.showStatus('Распознавание речи...', 'processing');
            
            const text = await this.recognizeSpeech(audioBase64, codec);
            
            this.updateProgress(90);
            this.recognizedText = text;
            
            this.updateProgress(100);
            this.showStatus('Речь успешно распознана!', 'success');
            
            this.downloadBtn.style.display = 'inline-block';
            this.downloadBtn.disabled = false;
            
        } catch (error) {
            console.error('Ошибка:', error);
            this.showStatus(`Ошибка: ${error.message}`, 'error');
        }
    }
    
    async recognizeSpeech(audioBase64, codec) {
        const url = 'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize';
        
        // Удаляем префикс data:audio/...;base64,
        const base64Data = audioBase64.split(',')[1];
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                config: {
                    specification: {
                        languageCode: 'ru-RU',
                        model: 'general',
                        profanityFilter: true,
                        audioEncoding: codec,
                        sampleRateHertz: 48000
                    }
                },
                audio: {
                    content: base64Data
                }
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка распознавания речи');
        }
        
        const result = await response.json();
        return result.result;
    }
    
    detectCodec(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        const type = file.type;
        
        if (type.includes('ogg') || extension === 'ogg') return 'OGG_OPUS';
        if (type.includes('m4a') || extension === 'm4a') return 'MPEG_AUDIO';
        if (type.includes('flac') || extension === 'flac') return 'FLAC';
        if (type.includes('wav') || extension === 'wav') return 'LINEAR16_PCM';
        if (type.includes('mp3') || extension === 'mp3') return 'MP3';
        
        return 'OGG_OPUS'; // По умолчанию
    }
    
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    updateProgress(percent) {
        this.progressBar.style.width = `${percent}%`;
    }
    
    showStatus(message, type = 'processing') {
        this.status.textContent = message;
        this.status.className = 'status ' + type;
        
        if (type === 'error') {
            this.progressContainer.style.display = 'none';
        }
    }
    
    downloadDocx() {
        if (!this.recognizedText) return;
        
        // Создаем простой DOCX контент
        const docxContent = this.createDocx(this.recognizedText);
        const blob = new Blob([docxContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const originalName = this.audioFile.name.split('.')[0];
        a.download = `${originalName}_расшифровка.docx`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
    
    createDocx(text) {
        // Простая реализация DOCX через шаблон
        const lines = text.split('\n');
        let paragraphs = '';
        
        lines.forEach(line => {
            if (line.trim()) {
                paragraphs += `<w:p><w:r><w:t>${this.escapeXml(line)}</w:t></w:r></w:p>`;
            }
        });
        
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        ${paragraphs}
        <w:p><w:r><w:t></w:t></w:r></w:p>
    </w:body>
</w:document>`;
    }
    
    escapeXml(text) {
        return text.replace(/[<>&'"]/g, function(c) {
            switch(c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new SpeechRecognitionApp();
});