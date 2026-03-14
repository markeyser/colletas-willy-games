# Willy & Collets' Games

A collection of fun, family-friendly web games designed to be played across multiple devices, including iPads and desktop computers.

## The Games

1. **Nut Rush! Deluxe** (`/nut_rush/`)
   - Catch the falling nuts before time runs out! Watch out for rocks and rotten nuts.
2. **Candy Coaster** (`/candy_coaster/`)
   - Steer your cart and snag cloud candies on a fast-paced rollercoaster ride!

## Controls

Both games support automatic control switching based on the device:

### Desktop (Keyboard)
*   **Player 1 (Collets):** `A` and `D` keys.
*   **Player 2 (Willy):** `Left Arrow` and `Right Arrow` keys.
*   **Pause:** `P` key.

### iPad / Tablet (Touch)
*   On-screen touch buttons (`<` and `>`) automatically appear and capture touch events.
*   A dedicated on-screen pause button is available.
*   The screens are locked (no zooming or bouncing) to handle rapid tapping.

---

## Deployment & Cloud Hosting

This repository is configured to deploy automatically via **Netlify** to provide a permanent, easy-to-access URL for iPads or phones without needing a local development server.

### How it works:
1. This GitHub repository (`colletas-willy-games`) is linked to a Netlify project.
2. The `index.html` file at the root acts as the "Game Hub" menu.
3. Every time a new commit is pushed to the `main` branch of this repository, Netlify automatically detects the change, rebuilds the site, and publishes the updates live.

### Adding New Games or Making Changes
To add a new game or edit an existing one:
1. Make the changes to the files locally on your computer.
2. If adding a new game, put it in its own folder (like `/new_game_name/`) and add a button linking to it in the root `index.html`.
3. Open your terminal and push the changes to GitHub:
   ```bash
   git add .
   git commit -m "Added a new game"
   git push origin main
   ```
4. Within a few seconds, Netlify will update the live website! 

### Accessing the Games
Simply navigate to your Netlify public URL on any device (e.g., iPad Safari). 
*Tip: On iPad Safari, tap the Share icon and select **"Add to Home Screen"** to create a native-feeling app icon!*
