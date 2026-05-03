# Firebase Setup Guide for Comments

## Why Firebase?

✅ **Real-time sync** - Comments appear instantly on all devices  
✅ **Free tier** - 1GB storage, 10GB/month bandwidth  
✅ **No server needed** - Serverless architecture  
✅ **Easy setup** - Just copy config values  
✅ **Scalable** - Handles many concurrent users  

---

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** (or "Add project")
3. Enter project name: `undangan-wedding` (or any name)
4. Disable Google Analytics (optional, not needed)
5. Click **"Create Project"**

---

## Step 2: Create Realtime Database

1. In Firebase Console, click **"Build"** → **"Realtime Database"**
2. Click **"Create Database"**
3. Choose location: **Singapore** (asia-southeast1) for Indonesia
4. Select **"Start in test mode"** (we'll secure it later)
5. Click **"Enable"**

---

## Step 3: Get Firebase Config

1. Click the **⚙️ gear icon** → **"Project settings"**
2. Scroll down to **"Your apps"**
3. Click the **web icon** `</>`
4. Register app name: `undangan-web`
5. Copy the `firebaseConfig` object:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB...",
  authDomain: "undangan-wedding.firebaseapp.com",
  databaseURL: "https://undangan-wedding-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "undangan-wedding",
  storageBucket: "undangan-wedding.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## Step 4: Update Your Code

Edit `js/connection/firebase-data.js` and paste your config:

```javascript
// Line 10-18: Replace with your config
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

---

## Step 5: Update Imports

### In `js/app/components/comment.js`:

```javascript
// Change this line:
import { localData } from '../../connection/local-data.js';

// To this:
import { firebaseData as localData } from '../../connection/firebase-data.js';
```

### In `js/app/components/like.js`:

```javascript
// Change this line:
import { localData } from '../../connection/local-data.js';

// To this:
import { firebaseData as localData } from '../../connection/firebase-data.js';
```

---

## Step 6: Migrate Existing Comments (Optional)

If you have comments in `data/comments.json`, migrate them:

Open browser console and run:
```javascript
// This migrates data/comments.json to Firebase
await undangan.comment.firebaseData?.migrateFromJSON();
```

---

## Step 7: Secure Your Database

Go to Firebase Console → Realtime Database → **Rules** tab.

Replace with these rules:

```json
{
  "rules": {
    "comments": {
      ".read": true,
      ".write": true,
      "$commentId": {
        ".validate": "newData.hasChildren(['uuid', 'name', 'comment', 'created_at'])",
        "name": {
          ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 50"
        },
        "comment": {
          ".validate": "newData.isString() && newData.val().length <= 1000"
        },
        "like_count": {
          ".validate": "newData.isNumber() && newData.val() >= 0"
        }
      }
    }
  }
}
```

These rules:
- ✅ Allow anyone to read/write comments
- ✅ Validate comment structure
- ✅ Limit name to 50 chars
- ✅ Limit comment to 1000 chars

---

## Testing

1. Open your invitation page
2. Add a comment
3. Open Firebase Console → Realtime Database
4. You should see the comment appear!
5. Open the page on another device/browser
6. The comment should be visible there too! 🎉

---

## Comparison

| Feature | Firebase | GitHub DB | localStorage | Original API |
|---------|----------|-----------|--------------|--------------|
| **Real-time sync** | ✅ Instant | ⚠️ Delayed | ❌ No | ✅ Yes |
| **Free tier** | ✅ Generous | ✅ Unlimited | ✅ Yes | ✅ Yes |
| **Speed** | ✅ Fast | ⚠️ Slow | ✅ Fast | ✅ Fast |
| **Setup** | ⚠️ 5 min | ⚠️ Token | ✅ None | ✅ Ready |
| **Scalability** | ✅ High | ⚠️ Limited | ❌ N/A | ✅ High |

---

## Troubleshooting

### "Permission denied" error
- Check Rules tab in Firebase Console
- Make sure `.read` and `.write` are `true` for testing

### Comments not syncing
- Check `databaseURL` is correct
- Check browser console for errors

### Firebase SDK not loading
- Check internet connection
- Try clearing browser cache

---

## Need Help?

Just ask and I'll help you configure it! 🚀
