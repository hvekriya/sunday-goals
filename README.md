# Team Balancer

Web app that loads players from a Google Spreadsheet (name, ranking, picture) and generates **x** equal teams by skill. Each generation gets a **unique shareable URL** for today’s teams.

## Google Sheet setup

1. Create a sheet with columns (headers can vary; these are detected):
   - **Name** – player name
   - **Ranking** – one of: `S`, `A`, `B`, `C`, or `Unranked` (or leave blank)
   - **Image** – optional; URL of player picture (or use column names: Picture / Photo / Avatar)

2. Share the sheet: **Anyone with the link can view**.

3. Use either:
   - The full sheet URL, or  
   - Just the spreadsheet ID (the long string in the URL: `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`).

## Run locally

```bash
cd team-balancer-app
npm install
npm run dev
```

- Frontend: http://localhost:5173  
- API: http://localhost:3001  

Then:

1. Paste your spreadsheet ID or full Google Sheet URL (and sheet name if not “Sheet1”).
2. Click **Load players**.
3. Set **Number of teams** and click **Generate teams**.
4. Copy the **unique URL** (e.g. `http://localhost:5173/t/abc123xyz`) to share today’s teams.

## Production build

```bash
npm run build
PORT=3001 npm start
```

Open http://localhost:3001; the app serves the built frontend and API.

## How balancing works

Rankings are converted to points: **S=4, A=3, B=2, C=1, Unranked=0**. Players are sorted by points and distributed in a **snake draft** (e.g. Team1 → Team2 → Team3 → Team3 → Team2 → Team1) so total strength is similar across teams.
