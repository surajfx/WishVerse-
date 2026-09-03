# WishVerse v2

Mobile-first WishVerse website with:

- Responsive mobile layout
- Home page and wish-card gallery
- 15 ready-made wish cards
- Search and category filters
- Card preview and customization modal
- Firebase Firestore save
- Optional Cloudinary image upload
- Shareable wish links
- Local favorites
- Dark/light theme
- GitHub Pages compatible static deployment

## Upload files

Upload these files to the root of your GitHub repository:

- index.html
- styles.css
- app.js
- firestore.rules

## Firebase

The Firebase configuration for project `surajfx2` is already included in `app.js`.

In Firebase Console:

1. Open Firestore Database.
2. Create the database.
3. Open Rules.
4. Paste the content of `firestore.rules`.
5. Click Publish.

## Cloudinary

Open `app.js` and replace:

```js
const cloudName = "YOUR_CLOUDINARY_CLOUD_NAME";
const uploadPreset = "YOUR_UNSIGNED_UPLOAD_PRESET";
```

Use an unsigned upload preset.

## GitHub Pages

Repository Settings → Pages → Deploy from branch → `main` → `/root` → Save.

Your website URL:

https://surajfx.github.io/WishVerse-/
