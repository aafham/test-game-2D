# DODGE RUN (Web 2D Endless Runner)

`DODGE RUN` ialah game HTML5 Canvas + Vanilla JS yang boleh terus dimainkan dengan double-click `index.html` (tiada bundler wajib).

## Run
1. Pastikan fail ini ada dalam folder sama:
   - `index.html`
   - `style.css`
   - `main.js`
2. Double-click `index.html`.
3. Game terus jalan dalam browser.

Audio WebAudio adalah optional. Jika browser block audio/autoplay, game masih berfungsi penuh tanpa audio.

## Controls
### Desktop
- `Left / A`: Gerak kiri
- `Right / D`: Gerak kanan
- `Space`: Pause / Resume
- `F` atau butang `AB`: Dash + Slow-motion ability (cooldown)
- Start Screen:
  - `C`: Tukar skin
  - `R`: Reset high score
  - `L`: Reset local leaderboard

### Mobile
- Tap kiri canvas: Move left
- Tap kanan canvas: Move right
- Swipe kiri/kanan: Ubah arah dengan cepat
- Butang `AB`: Activate ability

## Core Features
- Delta-time physics (`requestAnimationFrame` + time-based movement)
- Smooth movement (velocity + friction)
- AABB collision
- Difficulty scaling ikut masa (level, speed, spawn tuning)
- Spawn anti-overlap (min gap time + min x gap)
- Local high score (`localStorage`)
- Pause betul-betul berhenti update physics/spawn

## Upgrade Features (Implemented)
1. **Shield Power-up**
   - Pickup shield block 1 hit (max stack 2).
2. **Magnet Power-up**
   - Tarik coin dalam radius untuk beberapa saat.
3. **Dash + Slow-motion Ability**
   - Aktivasi dengan cooldown; beri burst gerakan + slow world time.
4. **Combo Multiplier**
   - Dodge berturut-turut dalam combo window naikkan multiplier (hingga x5).
5. **Skin System**
   - Beberapa skin palette untuk player/obstacle/boss.
6. **Daily Challenge + Reward**
   - Challenge berubah ikut tarikh.
   - Reward diberi sekali sehari (score + coins).
7. **Leaderboard**
   - Local leaderboard fallback (auto simpan).
   - Optional online leaderboard endpoint.
8. **Boss Wave**
   - Setiap beberapa level muncul wave pattern khas dengan tekanan lebih tinggi.

## Optional Online Leaderboard
Secara default game guna local leaderboard (`localStorage`).

Kalau nak guna remote API, set global variable sebelum `main.js` load:

```html
<script>
  window.DODGE_LEADERBOARD_ENDPOINT = "https://your-api.example.com/leaderboard";
</script>
<script src="main.js"></script>
```

Expected endpoint:
- `GET {endpoint}/top?limit=10` -> array `{ name, score, date }`
- `POST {endpoint}/submit` body JSON `{ name, score, date }`

Jika endpoint gagal/tiada, game auto fallback ke local leaderboard.

## Dev Notes
- Tiada dependency/framework.
- Struktur modular function-level, senang extend.
- Function global helper:
  - `resetHighScore()`
  - `resetLeaderboard()`

