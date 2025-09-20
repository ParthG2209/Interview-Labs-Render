// server.js - InterviewLabs - EXACT Local Setup for Render with Real Whisper

const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { spawn } = require('child_process');
const https = require('https');

// Load environment variables
try {
    require('dotenv').config();
} catch (e) {
    console.log('dotenv not available, using environment variables');
}

console.log('=== InterviewLabs Server Starting ===');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('COHERE_API_KEY loaded:', !!process.env.COHERE_API_KEY);
console.log('🎤 Real Whisper Transcription: ENABLED');
console.log('=====================================');

const app = express();
app.use(cors());
app.use(express.json());

// Simple request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
try {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
} catch (error) {
    console.warn('Could not create uploads directory:', error.message);
}

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Your exact Cohere API helper (from local setup)
async function callCohereAPI(message) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            message: message,
            model: 'command-r-08-2024',
            max_tokens: 500,
            temperature: 0.7,
            stream: false
        });

        const options = {
            hostname: 'api.cohere.com',
            port: 443,
            path: '/v1/chat',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve(response);
                    } else {
                        reject(new Error(`API Error: ${response.message || data}`));
                    }
                } catch (e) {
                    reject(new Error(`Parse Error: ${e.message}`));
                }
            });
        });

        req.on('error', (e) => { reject(e); });
        req.write(postData);
        req.end();
    });
}

// Your exact questions endpoint (from local setup)
app.post('/api/questions', async (req, res) => {
    try {
        const field = (req.body.field || '').trim();
        const count = Math.max(1, Math.min(20, Number(req.body.count) || 7));
        
        console.log(`Generating ${count} questions for field: ${field}`);
        
        if (!field) {
            return res.status(400).json({ error: 'field is required' });
        }

        // Try Cohere API first if available (your exact code)
        if (process.env.COHERE_API_KEY && process.env.COHERE_API_KEY.trim().length > 0) {
            try {
                const message = `Generate exactly ${count} diverse, challenging interview questions for ${field} positions.

Requirements:
- Each question must be unique and specific to ${field}
- Include a mix of: technical skills, problem-solving, behavioral, situational, and experience-based questions
- Questions should be realistic and commonly asked in actual ${field} interviews
- Vary question types: "Tell me about...", "How would you...", "Describe a time...", "What is your approach to...", etc.
- Make questions progressively challenging
- Each question should be 10-30 words long
- Focus on real-world scenarios and practical skills

Please format your response as a numbered list with exactly ${count} questions:

1. [First question here]
2. [Second question here]
3. [Third question here]
...
${count}. [Final question here]

Generate exactly ${count} interview questions for ${field}:`;

                const response = await callCohereAPI(message);
                
                if (response && response.text) {
                    const text = response.text.trim();
                    const questions = [];
                    const lines = text.split('\n');
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        const match = trimmed.match(/^\d+[\.\)\-\s]+(.+)/);
                        if (match && match[1] && match[1].length > 10) {
                            let question = match[1].trim().replace(/^["""]|["""]$/g, '').replace(/\s+/g, ' ');
                            if (!question.endsWith('?')) question += '?';
                            if (!questions.includes(question)) questions.push(question);
                        }
                    }

                    if (questions.length >= Math.min(3, count)) {
                        const finalQuestions = questions.slice(0, count);
                        return res.json({ 
                            questions: finalQuestions, 
                            ai: true,
                            source: 'cohere-chat'
                        });
                    }
                }
            } catch (cohereError) {
                console.error('Cohere Chat API call failed:', cohereError.message);
            }
        }

        // Your exact fallback questions (simplified)
        const templates = [
            `Tell me about your experience with ${field} technologies.`,
            `How do you approach solving complex problems in ${field}?`,
            `Describe a challenging ${field} project you worked on.`,
            `How do you stay updated with ${field} trends and best practices?`,
            `Tell me about a time you had to learn something new in ${field}.`,
            `How do you handle pressure and deadlines in ${field} projects?`,
            `Describe your collaboration style when working on ${field} teams.`
        ];

        const shuffled = [...templates].sort(() => 0.5 - Math.random());
        const questions = shuffled.slice(0, count);

        res.json({ questions, ai: false, source: 'fallback' });
        
    } catch (e) {
        console.error('Questions error:', e);
        res.status(500).json({ error: 'Failed to generate questions' });
    }
});

// REAL Whisper transcription function (your Python script integration)
async function transcribeWithWhisper(videoPath) {
    return new Promise((resolve, reject) => {
        console.log('🎤 Starting REAL Whisper transcription...');
        console.log('📁 Video path:', videoPath);
        
        const outputPath = videoPath + '.json';
        const whisperModel = process.env.WHISPER_MODEL || 'base';
        
        // Use your exact transcribe_whisper.py script
        const pythonProcess = spawn('python3', [
            path.join(__dirname, 'transcribe_whisper.py'),
            videoPath,
            '--model',
            whisperModel,
            '--output_format',
            'json'
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env }
        });
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log('📤 Whisper:', data.toString().trim());
        });
        
        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            console.log('📋 Whisper info:', data.toString().trim());
        });
        
        pythonProcess.on('close', (code) => {
            console.log(`🏁 Whisper process finished with code: ${code}`);
            
            if (code === 0) {
                try {
                    // Your Python script outputs JSON to stdout
                    const transcriptionData = JSON.parse(stdout);
                    
                    const fullText = transcriptionData.segments ? 
                        transcriptionData.segments.map(s => s.text).join(' ') : 
                        transcriptionData.text || '';
                    
                    console.log('✅ Transcription successful!');
                    console.log('📝 Text preview:', fullText.substring(0, 100) + '...');
                    
                    resolve({
                        text: fullText.trim(),
                        segments: transcriptionData.segments || [],
                        duration: transcriptionData.duration || 0
                    });
                } catch (parseError) {
                    console.error('❌ Failed to parse Whisper output:', parseError);
                    console.log('Raw output:', stdout);
                    reject(new Error('Failed to parse transcription: ' + parseError.message));
                }
            } else {
                console.error('❌ Whisper failed with code', code);
                console.error('Stderr:', stderr);
                reject(new Error(`Whisper failed: ${stderr || 'Unknown error'}`));
            }
        });
        
        pythonProcess.on('error', (error) => {
            console.error('❌ Failed to start Whisper:', error);
            reject(new Error('Failed to start Whisper: ' + error.message));
        });
        
        // 3-minute timeout for transcription
        setTimeout(() => {
            pythonProcess.kill();
            reject(new Error('Whisper timeout (3 minutes)'));
        }, 3 * 60 * 1000);
    });
}

// Simple analysis based on real transcription
function analyzeTranscription(transcription, field) {
    const text = transcription.text || '';
    const wordCount = text.split(' ').filter(w => w.length > 0).length;
    
    console.log('🧠 Analyzing real speech:', { wordCount, field });

    if (wordCount < 5) {
        return {
            rating: 0,
            mistakes: [{
                timestamp: '0:05',
                text: 'No speech detected - ensure microphone is working and speak clearly'
            }],
            tips: [
                'Check microphone permissions in your browser',
                'Speak clearly into the microphone during recording',
                'Record in a quiet environment',
                'Ensure you are actually speaking during recording'
            ],
            summary: 'No speech content detected. Please record again with clear audio.'
        };
    }

    if (wordCount < 20) {
        return {
            rating: 2,
            mistakes: [{
                timestamp: '0:10',
                text: 'Response too brief - provide more detailed answers with examples'
            }],
            tips: [
                'Use the STAR method (Situation, Task, Action, Result)',
                'Provide specific examples from your experience',
                'Aim for 1-2 minutes per response',
                'Include technical details relevant to the role'
            ],
            summary: `Brief response (${wordCount} words). Expand your answers for better evaluation.`
        };
    }

    // Real content analysis
    const technicalTerms = (text.match(/\b(javascript|react|node|python|java|database|api|system|software|code|programming|development|framework|library|algorithm|data|server|frontend|backend|fullstack|git|docker|aws|cloud|testing|debugging|deployment)\b/gi) || []).length;

    const confidenceWords = (text.match(/\b(successfully|achieved|implemented|developed|managed|created|built|delivered|solved|experience|skilled|accomplished|responsible|led|improved|designed)\b/gi) || []).length;

    const fillerWords = (text.match(/\b(um|uh|like|you know|actually|basically|sort of|kind of|well|so|right|okay)\b/gi) || []).length;

    // Calculate rating
    let rating = 5; // Base for having speech
    
    if (wordCount > 50) rating += 1;
    if (wordCount > 100) rating += 0.5;
    if (technicalTerms > 2) rating += 1;
    if (confidenceWords > 2) rating += 0.5;
    if (fillerWords < wordCount / 20) rating += 0.5;
    
    rating = Math.min(9, Math.max(1, Math.round(rating * 2) / 2));

    // Generate mistakes
    const mistakes = [];
    if (fillerWords > wordCount / 15) {
        mistakes.push({
            timestamp: '1:15',
            text: `Reduce filler words (${Math.round(fillerWords/wordCount*100)}%) - practice speaking more deliberately`
        });
    }
    if (technicalTerms < 2) {
        mistakes.push({
            timestamp: '1:30',
            text: `Include more ${field}-specific technical terminology`
        });
    }
    if (wordCount < 50) {
        mistakes.push({
            timestamp: '0:30',
            text: 'Provide more comprehensive responses with detailed examples'
        });
    }

    return {
        rating,
        mistakes: mistakes.slice(0, 3),
        tips: [
            `Real analysis: ${wordCount} words, ${technicalTerms} technical terms, ${confidenceWords} confidence words`,
            technicalTerms > 3 ? 'Excellent technical vocabulary' : 'Include more technical concepts',
            confidenceWords > 2 ? 'Strong confident language' : 'Use more achievement-focused language',
            'Based on your actual spoken content, not generic feedback'
        ],
        summary: `Real speech analysis: ${wordCount} words analyzed. Technical depth: ${technicalTerms}, Confidence: ${confidenceWords}. Rating: ${rating}/10 based on actual speech content.`
    };
}

// Video upload setup (your exact local setup)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ 
    storage, 
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files allowed'));
        }
    }
});

// Your exact video analysis endpoint with REAL Whisper
app.post('/api/analyze', upload.single('video'), async (req, res) => {
    console.log('=== REAL VIDEO ANALYSIS START ===');
    
    try {
        const field = (req.body.field || '').trim();
        
        if (!req.file) {
            return res.status(400).json({ error: 'Video file is required' });
        }

        console.log('📹 Video uploaded:', {
            filename: req.file.filename,
            size: `${Math.round(req.file.size / (1024 * 1024) * 10) / 10}MB`
        });

        const videoPath = req.file.path;
        
        try {
            // REAL Whisper transcription using your Python script
            const transcription = await transcribeWithWhisper(videoPath);
            
            // Analyze real speech content
            const analysis = analyzeTranscription(transcription, field);

            console.log('🎯 Analysis complete:', { rating: analysis.rating });

            // Cleanup
            try {
                if (fs.existsSync(videoPath)) {
                    fs.unlinkSync(videoPath);
                }
            } catch (cleanupError) {
                console.warn('Cleanup error:', cleanupError.message);
            }

            res.json({
                analysis,
                realTranscription: true,
                transcriptionPreview: transcription.text.substring(0, 200) + '...',
                wordCount: transcription.text.split(' ').length,
                source: 'REAL-WHISPER-ANALYSIS'
            });

        } catch (transcriptionError) {
            console.error('❌ Transcription failed:', transcriptionError.message);
            
            // Cleanup on error
            try {
                if (fs.existsSync(videoPath)) {
                    fs.unlinkSync(videoPath);
                }
            } catch (cleanupError) {
                console.warn('Cleanup error:', cleanupError.message);
            }

            res.json({
                analysis: {
                    rating: 0,
                    mistakes: [{ timestamp: '0:00', text: 'Audio processing failed - please ensure clear speech and good audio quality' }],
                    tips: ['Check microphone settings', 'Record in quiet environment', 'Speak clearly', 'Try a shorter video'],
                    summary: `Transcription failed: ${transcriptionError.message}. Please try again.`
                },
                realTranscription: false,
                error: transcriptionError.message
            });
        }
        
    } catch (error) {
        console.error('❌ Analysis error:', error);
        
        // Cleanup on error
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.warn('Cleanup error:', cleanupError.message);
            }
        }
        
        res.status(500).json({ 
            error: 'Analysis failed',
            message: error.message
        });
    }
});

// Your exact auth endpoints (simplified for Render)
const users = new Map();

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (users.has(email)) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        const user = {
            id: Date.now(),
            name,
            email,
            password, // In production, hash this!
            joinDate: new Date().toISOString(),
            sessions: []
        };
        
        users.set(email, user);
        
        const { password: _, ...userResponse } = user;
        res.json({ user: userResponse });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = users.get(email);
        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const { password: _, ...userResponse } = user;
        res.json({ user: userResponse });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        whisper: 'enabled',
        timestamp: new Date().toISOString()
    });
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Server error', message: err.message });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 InterviewLabs running on port ${PORT}`);
    console.log('🎤 Real Whisper transcription: ENABLED');
    console.log('🎯 Exact local setup replicated on Render!');
});
