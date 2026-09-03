# WishVerse

A smooth, responsive wish-card website with:

- Home page and animated wish-card gallery
- 15 ready-made wish experiences
- Card preview and customization
- Photo upload through Cloudinary
- Firestore wish storage
- Unique shareable wish links
- Favorites saved in the browser
- Dark/light theme
- GitHub Pages friendly static deployment

## 1. Upload to GitHub

Upload all files in this folder to the root of your repository:

```text
index.html
styles.css
app.js
firestore.rules
README.md
```

## 2. Firebase setup

The Firebase web configuration is already placed in `app.js`.

In Firebase Console:

1. Open Firestore Database.
2. Create a database.
3. Open Rules.
4. Paste the contents of `firestore.rules`.
5. Publish the rules.

The app uses this collection:

```text
wishes
  └── automatically generated document ID
      ├── templateId
      ├── templateTitle
      ├── from
      ├── to
      ├── message
      ├── imageUrl
      └── createdAt
```

## 3. Cloudinary setup

The app is configured with:

```text
Cloud name: wtlx95j4
Upload preset: ml_default
```

The upload preset must be unsigned in Cloudinary:

Cloudinary Dashboard → Settings → Upload → Upload presets → ml_default → Signing mode: Unsigned

For production, create a separate unsigned preset with a restricted upload folder.

## 4. GitHub Pages

1. Open the repository on GitHub.
2. Go to Settings → Pages.
3. Under Build and deployment, select `Deploy from a branch`.
4. Select `main` and `/root`.
5. Save.
6. Wait for the deployment to finish.

Your website will be available at:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

## Important note about share links

When Firebase is active, the wish document is saved in Firestore and the generated link contains the document ID. The current front-end includes the complete create-and-save flow.

For a production-grade public share page, add a Firestore document lookup by the hash ID and render that document on page load. The local fallback already works for testing in the same browser.
