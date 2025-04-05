# Aura Plus - AI Therapist Platform

## Overview
Aura Plus is an AI-powered therapist platform that provides secure, interactive voice-based therapy sessions with real-time analysis and personalized voice cloning capabilities.

## Features
- 🔐 Secure Authentication
- 🎙️ Interactive Voice Sessions
- 📝 Session History Tracking
- 🧠 Mental Health Analysis
- 🗣️ Voice Cloning
- 💬 Real-time Communication

## Tech Stack
- **Frontend**: Next.js
- **Backend**: Node.js with Express.js
- **Database**: MongoDB Atlas
- **Real-time**: Socket.IO
- **AI/ML**: 
  - Eleven Labs (STT, TTS, Voice Cloning)
  - Gemini 2.0 Flash (LLM)

## Project Structure
```
aura-plus/
├── client/                 # Next.js frontend
│   ├── app/               # App router
│   ├── components/        # Reusable components
│   ├── lib/              # Utility functions
│   └── styles/           # Global styles
└── server/               # Express.js backend
    ├── config/           # Configuration files
    ├── controllers/      # Route controllers
    ├── models/          # Database models
    ├── routes/          # API routes
    └── utils/           # Helper functions
```

## Getting Started

### Prerequisites
- Node.js >= 18
- MongoDB Atlas account
- Eleven Labs API key
- Gemini API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/aura-plus.git
cd aura-plus
```

2. Install frontend dependencies:
```bash
cd client
npm install
```

3. Install backend dependencies:
```bash
cd ../server
npm install
```

4. Set up environment variables:
Create `.env` files in both client and server directories.

Client `.env`:
```
NEXT_PUBLIC_API_URL=http://localhost:3005
```

Server `.env`:
```
PORT=3005
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
ELEVENLABS_API_KEY=your_elevenlabs_key
GEMINI_API_KEY=your_gemini_key
```

5. Start the development servers:

Frontend:
```bash
cd client
npm run dev
```

Backend:
```bash
cd server
npm run dev
```

## Features in Detail

### Authentication
- Email/password registration with verification
- JWT-based authentication
- Password reset functionality

### Therapy Sessions
- Real-time voice conversations
- Speech-to-text and text-to-speech processing
- Context-aware responses using Gemini 2.0 Flash

### Analysis
- Session summaries and progress tracking
- Mental health trend analysis
- Personalized insights

### Voice Cloning
- Custom voice profile creation
- Temporary voice cloning for single sessions
- Privacy-focused implementation

## Contributing
Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments
- Inspired by calmi.so and gallereee.framer.website
- Built with Next.js and Express.js
- Powered by Eleven Labs and Gemini 2.0 Flash 