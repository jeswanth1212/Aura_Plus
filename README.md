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

## Troubleshooting

### Connection Refused Errors

If you see errors like `POST http://localhost:3005/api/sessions/sync net::ERR_CONNECTION_REFUSED`:

1. **Server Not Running**: Make sure the server is running with `npm run dev` in the `website/server` directory.

2. **Offline Mode**: The application will automatically switch to offline mode if the server is unavailable. You'll see a yellow notification bar at the top of the dashboard and analysis pages.

3. **Port Conflict**: If port 3005 is already in use, you can change it in the server's `.env` file. Remember to update the client's `.env.local` file to match.

4. **Firewall Issues**: Make sure your firewall isn't blocking connections to localhost:3005.

### MongoDB Connection Issues

If you're having issues with MongoDB connections:

1. **Local Development**: You can run without a MongoDB connection in development mode. The server will use mock data.

2. **Connection String**: Make sure your MongoDB connection string in the server's `.env` file is correct.

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
- In offline mode, the app will still function using localStorage only 