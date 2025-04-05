# Aura Plus

An AI-powered therapy platform offering conversational mental health support.

## Development Setup

### Environment Setup

1. **Client Environment**

   Create a `.env.local` file in `website/client/` with:

   ```
   NEXT_PUBLIC_GEMINI_API_KEY=AIzaSyD9sQ_gusoVyB0Td0lFST2zbxw-FsOfoBQ
   NEXT_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   NEXT_PUBLIC_API_URL=http://localhost:3005
   ```

2. **Server Environment**

   Ensure the `.env` file in `website/server/` has:

   ```
   NODE_ENV=development
   PORT=3005
   MONGODB_URI=mongodb+srv://your_mongodb_conn_string_here
   JWT_SECRET=37d42206fadfc98bd5e4a240cf29c3af7fc8a9e27dd4e3ed84f497a8d9198e0f
   JWT_EXPIRY=30d
   ```

   In development mode, the server will bypass authentication requirements and create a mock user.

### Running the Application

1. **Start the Server**

   ```bash
   cd website/server
   npm install
   npm run dev
   ```

2. **Start the Client**

   ```bash
   cd website/client
   npm install
   npm run dev
   ```

3. **Access the Application**

   Open your browser and navigate to: http://localhost:3000

## Development Notes

### Authentication in Development Mode

- In development mode, the server automatically creates a mock user for all requests
- No real authentication token is required for API calls
- Session syncing will work without a valid JWT

### API Model Configuration

- The Gemini API uses model `gemini-1.5-pro` for both conversation and analysis
- API calls include appropriate error handling for development

### Session Management

- Sessions are stored in localStorage with the key `aura_sessions`
- The format is an object with session IDs as keys
- A separate `user_sessions` list keeps track of all sessions for a user 