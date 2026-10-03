# SinglePoint Frontend

React 19 app built with Vite. Install dependencies with `npm install`, then:

- `npm start` runs the app at `http://localhost:5173`.
- `npm test` runs the Vitest suite once.
- `npm run build` writes the production bundle to `dist/`.

Set `VITE_API_URL` before starting or building to point the app at a non-default API. The default is `http://localhost:4000/api`.

Set `VITE_AUP_DECLINE_URL` to the page a user should land on after declining the mandatory Acceptable Use Policy gate (their session is ended immediately). Defaults to `about:blank` if unset.
