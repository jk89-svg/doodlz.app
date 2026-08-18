# doodly.io

Free, browser-based, no-download multiplayer drawing & guessing game.
Single Node process: HTTP static server + Socket.IO realtime game server.
Public quickplay rooms only, max 9 players per room, 3 rounds, 80s draw time,
English word list (1500 words).

## Run locally

```
npm install
npm start
```

Open http://localhost:3000

## Deploy (Render / Railway / Fly / any Node host)

- Build command: `npm install`
- Start command: `npm start`
- Listens on `process.env.PORT` (falls back to 3000).
- No database, no build step, no external services.
- Enable WebSockets on your host. For more than one instance, add the
  Socket.IO Redis adapter and sticky sessions at the load balancer.

## Files (all flat, no subfolders)

- `server.js`    - HTTP + Socket.IO server, all authoritative game logic
- `words.js`     - 1500 English words (3-30 characters)
- `usernames.js` - 1000 auto generated usernames for blank name fields
- `index.html`   - single page app shell (AdSense loader in `<head>`)
- `style.css`    - all styling, responsive portrait + landscape
- `app.js`       - client: avatars, canvas, chat, layout, UI
- `favicon.ico`, `robots.txt`, `ads.txt`, `package.json`, `.gitignore`

## AdSense

The loader script for `ca-pub-8471772384803302` is in the `<head>` of
`index.html`, with two non-intrusive slots (home banner, below-game banner).
Ads never overlap the canvas or the chat. Replace the `data-ad-slot` values
with your own slot IDs, and put your publisher ID in `ads.txt`.
