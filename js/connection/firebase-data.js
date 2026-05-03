/**
 * Firebase Database Service for Comments
 * Uses Firebase Realtime Database for real-time synced comments
 */
export const firebaseData = (() => {
    // ============================================
    // FIREBASE CONFIGURATION - UPDATE THESE VALUES
    // ============================================
    // Get these from: Firebase Console → Project Settings → General → Your apps → Web app
    const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
    };

    // ============================================

    // ============================================
    // SPAM PROTECTION CONFIGURATION
    // ============================================
    const SPAM_CONFIG = {
        COOLDOWN_MS: 30000,           // 30 seconds between comments
        DUPLICATE_WINDOW_MS: 300000,  // 5 minutes duplicate check window
        MAX_NAME_LENGTH: 50,          // Max characters for name
        MAX_COMMENT_LENGTH: 1000,     // Max characters for comment
        MAX_COMMENTS_PER_HOUR: 10,    // Max comments per hour per user
    };

    const STORAGE_KEY = 'firebase_spam_protection';
    // ============================================

    let db = null;
    let isInitialized = false;

    /**
     * Get spam protection data from localStorage
     * @returns {Object}
     */
    const getSpamData = () => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        } catch {
            return {};
        }
    };

    /**
     * Save spam protection data to localStorage
     * @param {Object} data 
     */
    const setSpamData = (data) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    };

    /**
     * Sanitize input to prevent XSS and injection
     * @param {string} input
     * @returns {string}
     */
    const sanitizeInput = (input) => {
        if (!input || typeof input !== 'string') {
            return '';
        }

        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .replace(/data:/gi, '') // Remove data: protocol
            .trim();
    };

    /**
     * Check if user can submit (rate limiting)
     * @returns {{allowed: boolean, message: string, waitTime: number}}
     */
    const checkRateLimit = () => {
        const data = getSpamData();
        const now = Date.now();

        // Check cooldown
        if (data.lastSubmit && (now - data.lastSubmit) < SPAM_CONFIG.COOLDOWN_MS) {
            const waitTime = Math.ceil((SPAM_CONFIG.COOLDOWN_MS - (now - data.lastSubmit)) / 1000);
            return { 
                allowed: false, 
                message: `Please wait ${waitTime} seconds before posting again.`,
                waitTime 
            };
        }

        // Check hourly limit
        const hourAgo = now - 3600000;
        const recentSubmissions = (data.submissions || []).filter(t => t > hourAgo);
        
        if (recentSubmissions.length >= SPAM_CONFIG.MAX_COMMENTS_PER_HOUR) {
            return { 
                allowed: false, 
                message: `You've reached the limit of ${SPAM_CONFIG.MAX_COMMENTS_PER_HOUR} comments per hour. Please try again later.`,
                waitTime: 0 
            };
        }

        return { allowed: true, message: '', waitTime: 0 };
    };

    /**
     * Check for duplicate comment
     * @param {string} comment 
     * @returns {boolean}
     */
    const isDuplicateComment = (comment) => {
        const data = getSpamData();
        const now = Date.now();
        const normalizedComment = comment.toLowerCase().trim();

        // Clean old entries
        const recentComments = (data.recentComments || []).filter(
            c => (now - c.time) < SPAM_CONFIG.DUPLICATE_WINDOW_MS
        );

        // Check for duplicate
        return recentComments.some(c => c.text === normalizedComment);
    };

    /**
     * Record submission for rate limiting
     * @param {string} comment 
     */
    const recordSubmission = (comment) => {
        const data = getSpamData();
        const now = Date.now();
        const hourAgo = now - 3600000;

        // Update last submit time
        data.lastSubmit = now;

        // Update submissions list (keep only last hour)
        data.submissions = [...(data.submissions || []).filter(t => t > hourAgo), now];

        // Update recent comments (keep only within duplicate window)
        data.recentComments = [
            ...(data.recentComments || []).filter(c => (now - c.time) < SPAM_CONFIG.DUPLICATE_WINDOW_MS),
            { text: comment.toLowerCase().trim(), time: now }
        ];

        setSpamData(data);
    };

    /**
     * Validate comment input
     * @param {string} name 
     * @param {string} comment 
     * @returns {{valid: boolean, message: string}}
     */
    const validateInput = (name, comment) => {
        // Validate name
        if (!name || name.trim().length === 0) {
            return { valid: false, message: 'Name cannot be empty.' };
        }
        if (name.length > SPAM_CONFIG.MAX_NAME_LENGTH) {
            return { valid: false, message: `Name must be ${SPAM_CONFIG.MAX_NAME_LENGTH} characters or less.` };
        }

        // Validate comment (only if not using GIF)
        if (comment && comment.length > SPAM_CONFIG.MAX_COMMENT_LENGTH) {
            return { valid: false, message: `Comment must be ${SPAM_CONFIG.MAX_COMMENT_LENGTH} characters or less.` };
        }

        return { valid: true, message: '' };
    };

    /**
     * Initialize Firebase
     * @returns {Promise<void>}
     */
    const init = async () => {
        if (isInitialized) { return; }

        if (!window.firebase) {
            await loadFirebaseSDK();
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        db = firebase.database();

        // Sign in anonymously so Security Rules can identify the user
        if (!window.firebase.auth().currentUser) {
            await window.firebase.auth().signInAnonymously().catch((err) => {
                console.warn('Anonymous auth unavailable:', err.message);
            });
        }

        isInitialized = true;
    };

    /**
     * Load Firebase SDK dynamically
     * @returns {Promise<void>}
     */
    const loadFirebaseSDK = () => {
        return new Promise((resolve, reject) => {
            const appScript = document.createElement('script');
            appScript.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
            appScript.onload = () => {
                const scripts = [
                    'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
                    'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
                ];
                let loaded = 0;
                scripts.forEach((src) => {
                    const s = document.createElement('script');
                    s.src = src;
                    s.onload = () => { if (++loaded === scripts.length) { resolve(); } };
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
            };
            appScript.onerror = reject;
            document.head.appendChild(appScript);
        });
    };

    /**
     * Generate a simple UUID
     * @returns {string}
     */
    const generateUUID = () => {
        return 'comment-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    };

    /**
     * Convert Firebase object to array with nested comments
     * @param {Object} data 
     * @returns {Array}
     */
    const convertToArray = (data) => {
        if (!data) {return [];}

        return Object.values(data)
            .map(item => ({
                ...item,
                comments: item.comments ? convertToArray(item.comments) : []
            }))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    };

    /**
     * Get comments with pagination
     * @param {number} per - Items per page
     * @param {number} next - Offset
     * @returns {Promise<{count: number, lists: any[]}>}
     */
    const getComments = async (per = 10, next = 0) => {
        await init();

        try {
            const snapshot = await db.ref('comments').once('value');
            const data = snapshot.val();
            const lists = convertToArray(data);

            return {
                count: lists.length,
                lists: lists.slice(next, next + per)
            };
        } catch (error) {
            console.error('Failed to get comments:', error);
            return { count: 0, lists: [] };
        }
    };

    /**
     * Add a new comment
     * @param {string} name
     * @param {boolean} presence
     * @param {string} comment
     * @param {string|null} gifUrl
     * @param {string|null} parentUuid
     * @returns {Promise<{uuid: string, error?: string}>}
     */
    const addComment = async (name, presence, comment, gifUrl = null, parentUuid = null) => {
        await init();

        // Sanitize inputs
        const sanitizedName = sanitizeInput(name);
        const sanitizedComment = comment ? sanitizeInput(comment) : '';

        // Validate input
        const validation = validateInput(sanitizedName, sanitizedComment);
        if (!validation.valid) {
            return { uuid: null, error: validation.message };
        }

        // Check rate limit
        const rateLimit = checkRateLimit();
        if (!rateLimit.allowed) {
            return { uuid: null, error: rateLimit.message };
        }

        // Check for duplicate (only for text comments, not GIFs)
        if (sanitizedComment && isDuplicateComment(sanitizedComment)) {
            return { uuid: null, error: 'This comment was already posted recently. Please write something different.' };
        }

        const uuid = generateUUID();
        const uid = window.firebase.auth().currentUser?.uid ?? null;
        const newComment = {
            uuid,
            uid,
            name: sanitizedName,
            presence,
            comment: sanitizedComment,
            created_at: new Date().toISOString(),
            is_admin: false,
            is_parent: !parentUuid,
            gif_url: gifUrl,
            ip: null,
            user_agent: null,
            like_count: 0
        };

        try {
            if (parentUuid) {
                // Find parent and add as reply
                const parentPath = await findCommentPath(parentUuid);
                if (parentPath) {
                    await db.ref(`${parentPath}/comments/${uuid}`).set(newComment);
                } else {
                    console.error('Parent comment not found');
                    return { uuid: null, error: 'Parent comment not found.' };
                }
            } else {
                // Add as top-level comment
                await db.ref(`comments/${uuid}`).set(newComment);
            }

            // Record successful submission for rate limiting
            recordSubmission(sanitizedComment || 'gif');
            
            return { uuid };
        } catch (error) {
            console.error('Failed to add comment:', error);
            return { uuid: null, error: 'Failed to save comment. Please try again.' };
        }
    };

    /**
     * Find the path to a comment by UUID
     * @param {string} uuid 
     * @param {string} basePath 
     * @returns {Promise<string|null>}
     */
    const findCommentPath = async (uuid, basePath = 'comments') => {
        const snapshot = await db.ref(basePath).once('value');
        const data = snapshot.val();

        if (!data) {return null;}

        for (const key of Object.keys(data)) {
            if (key === uuid || data[key].uuid === uuid) {
                return `${basePath}/${key}`;
            }
            
            if (data[key].comments) {
                const nestedPath = await findCommentPath(uuid, `${basePath}/${key}/comments`);
                if (nestedPath) {return nestedPath;}
            }
        }

        return null;
    };

    /**
     * Update a comment
     * @param {string} uuid 
     * @param {string} comment 
     * @param {string|null} gifUrl 
     * @returns {Promise<{status: boolean}>}
     */
    const updateComment = async (uuid, comment, gifUrl = null) => {
        await init();

        try {
            const path = await findCommentPath(uuid);
            if (!path) {
                return { status: false };
            }

            const updates = {};
            if (comment !== null) {
                updates.comment = comment;
            }
            if (gifUrl !== null) {
                updates.gif_url = gifUrl;
            }

            await db.ref(path).update(updates);
            return { status: true };
        } catch (error) {
            console.error('Failed to update comment:', error);
            return { status: false };
        }
    };

    /**
     * Delete a comment
     * @param {string} uuid 
     * @returns {Promise<{status: boolean}>}
     */
    const deleteComment = async (uuid) => {
        await init();

        try {
            const path = await findCommentPath(uuid);
            if (!path) {
                return { status: false };
            }

            await db.ref(path).remove();
            return { status: true };
        } catch (error) {
            console.error('Failed to delete comment:', error);
            return { status: false };
        }
    };

    /**
     * Toggle like on a comment
     * @param {string} uuid 
     * @returns {Promise<{status: boolean}>}
     */
    const toggleLike = async (uuid) => {
        await init();

        // Track likes locally
        const likes = JSON.parse(localStorage.getItem('firebase_likes') || '{}');
        const isLiked = likes[uuid] || false;

        try {
            const path = await findCommentPath(uuid);
            if (!path) {
                return { status: false };
            }

            const snapshot = await db.ref(`${path}/like_count`).once('value');
            const currentLikes = snapshot.val() || 0;

            if (isLiked) {
                await db.ref(`${path}/like_count`).set(Math.max(0, currentLikes - 1));
                delete likes[uuid];
            } else {
                await db.ref(`${path}/like_count`).set(currentLikes + 1);
                likes[uuid] = true;
            }

            localStorage.setItem('firebase_likes', JSON.stringify(likes));
            return { status: true };
        } catch (error) {
            console.error('Failed to toggle like:', error);
            return { status: false };
        }
    };

    /**
     * Subscribe to real-time updates
     * @param {function} callback 
     * @returns {function} Unsubscribe function
     */
    const onCommentsChange = async (callback) => {
        await init();

        const ref = db.ref('comments');
        const listener = ref.on('value', (snapshot) => {
            const data = snapshot.val();
            const lists = convertToArray(data);
            callback({ count: lists.length, lists });
        });

        // Return unsubscribe function
        return () => ref.off('value', listener);
    };

    /**
     * Load initial data from JSON file (one-time migration)
     * @returns {Promise<void>}
     */
    const migrateFromJSON = async () => {
        await init();

        try {
            const response = await fetch('./data/comments.json');
            const data = await response.json();

            // Convert array to object with UUID as key
            const commentsObj = {};
            for (const comment of data.lists) {
                const repliesObj = {};
                if (comment.comments) {
                    for (const reply of comment.comments) {
                        repliesObj[reply.uuid] = reply;
                    }
                }
                commentsObj[comment.uuid] = {
                    ...comment,
                    comments: repliesObj
                };
            }

            await db.ref('comments').set(commentsObj);
            console.log('Migration complete!');
        } catch (error) {
            console.error('Migration failed:', error);
        }
    };

    return {
        init,
        getComments,
        addComment,
        updateComment,
        deleteComment,
        toggleLike,
        onCommentsChange,
        migrateFromJSON,
        // Spam protection utilities
        checkRateLimit,
        validateInput,
        sanitizeInput,
        SPAM_CONFIG
    };
})();
