// server.js - InterviewLabs Backend with REAL Video Transcription for Render

const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const { spawn } = require('child_process');
const https = require('https');

// Load environment variables
require('dotenv').config();
if (!process.env.COHERE_API_KEY && fs.existsSync(path.join(__dirname, 'project.env'))) {
    require('dotenv').config({ path: path.join(__dirname, 'project.env') });
}

console.log('=== InterviewLabs Server Starting ===');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('COHERE_API_KEY loaded:', !!process.env.COHERE_API_KEY);
console.log('WHISPER_MODEL:', process.env.WHISPER_MODEL || 'base');
console.log('🎤 Real Whisper Transcription: ENABLED');
console.log('=====================================');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

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

// REAL Whisper transcription function
async function transcribeVideoWithWhisper(videoPath) {
    return new Promise((resolve, reject) => {
        console.log('🎤 Starting REAL Whisper transcription...');
        console.log('Video path:', videoPath);
        
        const outputPath = videoPath + '.json';
        const whisperModel = process.env.WHISPER_MODEL || 'base';
        
        // Call the Python transcription script
        const pythonProcess = spawn('python3', [
            path.join(__dirname, 'transcribe_whisper.py'),
            videoPath,
            '--output',
            outputPath,
            '--model',
            whisperModel
        ], {
            env: { 
                ...process.env,
                PYTHONPATH: __dirname
            }
        });
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log('Whisper stdout:', data.toString().trim());
        });
        
        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            console.log('Whisper stderr:', data.toString().trim());
        });
        
        pythonProcess.on('close', (code) => {
            console.log(`Whisper process exited with code: ${code}`);
            
            if (code === 0) {
                try {
                    if (fs.existsSync(outputPath)) {
                        const transcriptionData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
                        
                        // Clean up output file
                        fs.unlinkSync(outputPath);
                        
                        const fullText = transcriptionData.segments ? 
                            transcriptionData.segments.map(s => s.text).join(' ') : 
                            transcriptionData.text || '';
                        
                        console.log('✅ Real transcription successful!');
                        console.log('📝 Transcribed text preview:', fullText.substring(0, 100) + '...');
                        
                        resolve({
                            text: fullText,
                            segments: transcriptionData.segments || [],
                            duration: transcriptionData.duration || 0
                        });
                    } else {
                        reject(new Error('Transcription output file not found'));
                    }
                } catch (error) {
                    console.error('Failed to parse transcription:', error);
                    reject(new Error('Failed to parse transcription: ' + error.message));
                }
            } else {
                console.error('Whisper failed:', stderr);
                reject(new Error(`Whisper failed with code ${code}: ${stderr}`));
            }
        });
        
        pythonProcess.on('error', (error) => {
            console.error('Failed to start Whisper process:', error);
            reject(new Error('Failed to start Whisper: ' + error.message));
        });
        
        // Timeout after 5 minutes
        setTimeout(() => {
            pythonProcess.kill();
            reject(new Error('Whisper transcription timeout (5 minutes)'));
        }, 5 * 60 * 1000);
    });
}

// Analyze REAL transcription content
async function analyzeRealTranscription(transcription, field) {
    const text = transcription.text || '';
    const wordCount = text.split(' ').length;
    
    console.log('🧠 Analyzing REAL speech content:', { wordCount, field });

    // Check for meaningful content
    if (wordCount < 5) {
        return {
            rating: 0,
            mistakes: [{
                timestamp: '0:05',
                text: 'No meaningful speech detected - ensure microphone is working and speak clearly'
            }],
            tips: [
                'Check microphone permissions in your browser',
                'Speak directly into the microphone during recording',
                'Record in a quiet environment without background noise',
                'Ensure you are actually speaking during the recording'
            ],
            summary: 'No speech content detected for analysis. Please record again with clear audio.'
        };
    }

    if (wordCount < 20) {
        return {
            rating: 2,
            mistakes: [{
                timestamp: '0:10',
                text: 'Response too brief - provide more detailed answers with specific examples'
            }],
            tips: [
                'Elaborate on your experience with concrete examples',
                'Use the STAR method (Situation, Task, Action, Result)',
                'Aim for 1-2 minutes per response',
                'Include specific technologies and metrics in your answers'
            ],
            summary: `Very brief response detected (${wordCount} words). Expand your answers for better evaluation.`
        };
    }

    // REAL content analysis based on actual speech
    const technicalTerms = (text.match(/\b(javascript|react|node|python|java|database|api|system|software|code|programming|development|framework|library|algorithm|data|server|frontend|backend|fullstack|git|docker|aws|cloud|microservices|testing|debugging|deployment|scalability|performance|security|architecture|html|css|typescript|angular|vue|spring|hibernate|mysql|postgresql|mongodb|redis|kubernetes|devops|ci|cd|agile|scrum)\b/gi) || []).length;

    const confidenceWords = (text.match(/\b(successfully|achieved|led|implemented|improved|optimized|designed|developed|managed|created|built|delivered|solved|experience|expertise|proficient|skilled|accomplished|responsible|contributed|collaborated|completed|established|enhanced|streamlined|automated|integrated|architected)\b/gi) || []).length;

    const fillerWords = (text.match(/\b(um|uh|like|you know|actually|basically|sort of|kind of|well|so|right|okay|yeah|hmm|er|ah)\b/gi) || []).length;

    const specificMetrics = (text.match(/\b(\d+%|\d+\s*(percent|times|years|months|weeks|days|users|customers|projects|team|members|million|thousand|hours|dollars|revenue|growth|reduction|increase|decrease|improvement))\b/gi) || []).length;

    const questionWords = (text.match(/\b(what|how|why|when|where|which|who|could you|can you|would you|do you|have you|will you)\b/gi) || []).length;

    console.log('📊 Real speech metrics:', {
        wordCount,
        technicalTerms,
        confidenceWords,
        fillerWords,
        specificMetrics,
        questionWords
    });

    // Calculate rating based on REAL speech analysis
    let rating = 4; // Base rating
    
    if (wordCount > 50) rating += 1; // Good length
    if (wordCount > 100) rating += 0.5; // Comprehensive
    if (technicalTerms > 2) rating += 1; // Technical depth
    if (technicalTerms > 5) rating += 0.5; // Strong technical vocabulary
    if (confidenceWords > 2) rating += 1; // Confident language
    if (confidenceWords > 4) rating += 0.5; // Very confident
    if (specificMetrics > 0) rating += 1; // Quantifiable results
    if (specificMetrics > 2) rating += 0.5; // Multiple metrics
    if (fillerWords < wordCount / 20) rating += 0.5; // Clear speech
    if (questionWords > 0) rating += 0.5; // Engagement
    
    // Field-specific bonuses
    const fieldLower = field.toLowerCase();
    if (fieldLower.includes('senior') && technicalTerms > 4) rating += 0.5;
    if (fieldLower.includes('intern') && confidenceWords > 1) rating += 0.5;
    if (fieldLower.includes('java') && text.toLowerCase().includes('java')) rating += 0.5;
    
    rating = Math.min(9, Math.max(1, Math.round(rating * 2) / 2));

    // Generate specific mistakes based on real content
    const mistakes = [];
    
    if (fillerWords > wordCount / 15) {
        const fillerPercent = Math.round((fillerWords / wordCount) * 100);
        mistakes.push({
            timestamp: findTimestampForIssue(transcription.segments, fillerWords),
            text: `Reduce filler words (${fillerPercent}% of speech) - practice speaking more deliberately`
        });
    }

    if (specificMetrics === 0 && wordCount > 30) {
        mistakes.push({
            timestamp: '1:30',
            text: 'Include specific metrics and quantifiable achievements in your examples'
        });
    }

    if (technicalTerms < 2 && wordCount > 30) {
        mistakes.push({
            timestamp: '2:00',
            text: `Use more ${field}-specific technical terminology to demonstrate expertise`
        });
    }

    if (confidenceWords < 2 && wordCount > 40) {
        mistakes.push({
            timestamp: '1:45',
            text: 'Use more confident, achievement-oriented language when describing your experience'
        });
    }

    if (wordCount < 40) {
        mistakes.push({
            timestamp: '0:30',
            text: 'Provide more comprehensive responses with detailed examples and context'
        });
    }

    // Generate real content-based tips
    const tips = [
        `Real speech analysis: ${wordCount} words analyzed from your actual response`,
        `Content includes ${technicalTerms} technical terms and ${confidenceWords} confidence indicators`,
        technicalTerms > 3 ? 'Excellent technical vocabulary usage detected' : `Include more ${field}-specific technical concepts and terminology`,
        confidenceWords > 2 ? 'Strong confident communication style observed' : 'Practice using more achievement-focused language',
        specificMetrics > 0 ? 'Good use of quantifiable results in your response' : 'Always include specific numbers and measurable outcomes',
        fillerWords < wordCount / 25 ? 'Clear, fluent speech patterns detected' : 'Practice reducing filler words for more professional delivery'
    ];

    return {
        rating,
        mistakes: mistakes.slice(0, 3),
        tips: tips.slice(0, 5),
        summary: `Real speech analysis of your ${wordCount}-word response. Technical depth: ${technicalTerms} terms, Confidence level: ${confidenceWords} indicators, Speech clarity: ${fillerWords} filler words. Overall rating: ${rating}/10. ${rating >= 7 ? 'Strong interview performance with clear technical communication based on your actual speech content.' : rating >= 5 ? 'Good foundation with specific areas for improvement identified from your real response.' : 'Focus on the recommended areas to significantly enhance your interview performance.'}`
    };
}

function findTimestampForIssue(segments, issueCount) {
    if (!segments || segments.length === 0) return '1:15';
    
    // Find a realistic timestamp from segments
    const midPoint = Math.floor(segments.length / 2);
    const segment = segments[midPoint] || segments[0];
    
    if (segment && segment.start !== undefined) {
        const minutes = Math.floor(segment.start / 60);
        const seconds = Math.floor(segment.start % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return '1:15'; // Default fallback
}

// Cohere API helper (your existing function)
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

// Your existing endpoints (debug, questions, auth) - keep them exactly the same
app.get('/api/debug', (req, res) => {
    res.json({ 
        message: 'InterviewLabs API working with REAL Whisper transcription!', 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        cohere: !!process.env.COHERE_API_KEY,
        whisper: 'enabled',
        routes: ['GET /api/debug', 'POST /api/questions', 'POST /api/analyze/video']
    });
});

// [Keep your existing /api/questions endpoint exactly as is]
app.post('/api/questions', async (req, res) => {
    // Your existing questions endpoint code here - don't change it
    try {
        console.log('=== QUESTIONS REQUEST ===');
        console.log('Request body:', req.body);
        
        const field = (req.body.field || '').trim();
        const count = Math.max(1, Math.min(20, Number(req.body.count) || 7));
        
        console.log(`Generating ${count} questions for field: ${field}`);
        
        if (!field) {
            return res.status(400).json({ error: 'field is required' });
        }

        res.setHeader('Content-Type', 'application/json');

        // Try Cohere API first if available
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
...
${count}. [Final question here]`;

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

        // Fallback questions
        const fallbackTemplates = {
            'software': [
                `Tell me about your experience with system design and architecture.`,
                `How do you approach debugging a complex production issue?`,
                `Describe a challenging technical problem you solved recently.`,
                `How would you optimize a slow-performing database query?`,
                `Explain your process for code reviews and maintaining code quality.`
            ],
            'java': [
                `Explain the difference between Java's heap and stack memory.`,
                `How do you handle memory management and garbage collection in Java applications?`,
                `Describe your experience with Java frameworks like Spring or Hibernate.`,
                `How would you optimize Java application performance?`,
                `Tell me about a complex Java multithreading problem you solved.`
            ],
            'intern': [
                `Why are you interested in this internship opportunity?`,
                `Tell me about a challenging project you worked on during your studies.`,
                `How do you prioritize your tasks when working on multiple assignments?`,
                `Describe a time you had to learn a new technology or skill quickly.`,
                `How would you handle receiving constructive criticism on your work?`
            ]
        };

        const fieldLower = field.toLowerCase();
        let selectedTemplates = fallbackTemplates.software;
        
        if (fieldLower.includes('java')) selectedTemplates = fallbackTemplates.java;
        else if (fieldLower.includes('intern')) selectedTemplates = fallbackTemplates.intern;

        const shuffled = [...selectedTemplates].sort(() => 0.5 - Math.random());
        const questions = shuffled.slice(0, count);

        res.json({ questions, ai: false, source: 'fallback' });
        
    } catch (e) {
        console.error('Questions error:', e);
        res.status(500).json({ error: 'Failed to generate questions' });
    }
});

// UPDATED video analysis endpoint with REAL Whisper transcription
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            if (!fs.existsSync(UPLOAD_DIR)) {
                fs.mkdirSync(UPLOAD_DIR, { recursive: true });
            }
            cb(null, UPLOAD_DIR);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ 
    storage, 
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for Render
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'));
        }
    }
});

app.post('/api/analyze/video', upload.single('video'), async (req, res) => {
    console.log('=== REAL VIDEO ANALYSIS START ===');
    
    try {
        const field = (req.body.field || '').trim();
        console.log('Field:', field);
        
        if (!req.file) {
            return res.status(400).json({ error: 'Video file is required' });
        }

        console.log('🎬 Video uploaded:', {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: `${Math.round(req.file.size / (1024 * 1024) * 10) / 10}MB`,
            mimetype: req.file.mimetype
        });

        const videoPath = req.file.path;
        
        try {
            // REAL Whisper transcription
            console.log('🎤 Starting REAL Whisper transcription...');
            const transcription = await transcribeVideoWithWhisper(videoPath);
            
            console.log('✅ Real transcription completed!');
            console.log('📝 Transcribed content preview:', transcription.text.substring(0, 150) + '...');

            // Analyze REAL speech content
            const analysis = await analyzeRealTranscription(transcription, field);

            console.log('🎯 Real analysis complete:', {
                rating: analysis.rating,
                wordCount: transcription.text.split(' ').length,
                source: 'REAL-WHISPER-TRANSCRIPTION'
            });

            // Cleanup
            try {
                if (fs.existsSync(videoPath)) {
                    fs.unlinkSync(videoPath);
                    console.log('🧹 Cleaned up video file');
                }
            } catch (cleanupError) {
                console.warn('Cleanup warning:', cleanupError.message);
            }

            res.json({
                analysis,
                realTranscription: true,
                transcriptionPreview: transcription.text.substring(0, 200) + '...',
                wordCount: transcription.text.split(' ').length,
                processingTime: 'Real Whisper analysis completed',
                source: 'REAL-WHISPER-TRANSCRIPTION'
            });

        } catch (transcriptionError) {
            console.error('❌ Real transcription failed:', transcriptionError.message);
            
            // Fallback analysis
            console.log('⚠️ Using fallback analysis due to transcription error');
            const fallbackAnalysis = {
                rating: 6,
                mistakes: [
                    { timestamp: '0:15', text: 'Audio transcription failed - ensure clear speech and good microphone quality' },
                    { timestamp: '0:45', text: 'Try recording in a quieter environment with better audio quality' }
                ],
                tips: [
                    'Real transcription temporarily unavailable - check audio quality',
                    'Ensure you are speaking clearly into the microphone',
                    'Record in a quiet environment without background noise',
                    'Try a shorter video (under 2 minutes) for better processing'
                ],
                summary: `Video processing attempted but transcription failed: ${transcriptionError.message}. Please try again with clearer audio.`
            };

            // Cleanup on error
            try {
                if (fs.existsSync(videoPath)) {
                    fs.unlinkSync(videoPath);
                }
            } catch (cleanupError) {
                console.warn('Error cleanup failed:', cleanupError.message);
            }

            res.json({
                analysis: fallbackAnalysis,
                realTranscription: false,
                error: 'Transcription failed',
                message: transcriptionError.message,
                source: 'FALLBACK-AFTER-WHISPER-ERROR'
            });
        }
        
    } catch (e) {
        console.error('=== VIDEO ANALYSIS ERROR ===');
        console.error('Error:', e);
        
        // Cleanup on error
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.warn('Error cleanup failed:', cleanupError.message);
            }
        }
        
        res.status(500).json({ 
            error: 'Analysis failed', 
            message: 'Video analysis error: ' + e.message
        });
    }
});

// Keep your existing auth endpoints exactly as they are
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
            password,
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
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development',
        cohere: !!process.env.COHERE_API_KEY,
        whisper: 'real-transcription-enabled'
    });
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`🚀 InterviewLabs server running on port ${PORT}`);
    console.log('🎤 Real Whisper transcription: ENABLED');
    console.log('🎯 Real video analysis: READY');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Cohere API configured:', !!process.env.COHERE_API_KEY);
    console.log('Server ready for Render deployment! 🎯');
});
