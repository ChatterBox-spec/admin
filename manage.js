// Firebase config (copy from your main app)
var firebaseConfig = {
    apiKey: "AIzaSyB1Zez4AFO52z5LjkQyZ9BpD2xFtR1Slr4",
    authDomain: "chatterbox-9ef65.firebaseapp.com",
    databaseURL: "https://chatterbox-9ef65-default-rtdb.firebaseio.com/",
    projectId: "chatterbox-9ef65",
    storageBucket: "chatterbox-9ef65.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);
var db = firebase.database();

const userList = document.getElementById('user-list');
const searchInput = document.getElementById('search-user');
const sortSelect = document.getElementById('sort-user');
const toast = document.getElementById('toast');
const showEmailsBtn = document.getElementById('show-emails-btn');
const emailsModal = document.getElementById('emails-modal');
const emailsListModal = document.getElementById('emails-list-modal');
const closeEmailsModalBtn = document.getElementById('close-emails-modal-btn');
const messagesModal = document.getElementById('messages-modal');
const messagesListModal = document.getElementById('messages-list-modal');
const closeMessagesModalBtn = document.getElementById('close-messages-modal-btn');

let allUsers = [];
let filteredUsers = [];
let sortMode = 'az';
let searchTerm = '';

function showToast(msg, success = true) {
    toast.textContent = msg;
    toast.style.background = success ? '#28a745' : '#ff4d4f';
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2200);
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
}

function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString();
}

function renderUser(user) {
    const li = document.createElement('li');
    li.className = 'user-item';
    if (user.banned) li.style.opacity = '0.5';
    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.textContent = getInitials(user.username);
    li.appendChild(avatar);
    // Details
    const details = document.createElement('div');
    details.className = 'user-details';
    const uname = document.createElement('div');
    uname.className = 'user-username';
    uname.textContent = user.username || '(no username)';
    if (user.banned) {
        const bannedBadge = document.createElement('span');
        bannedBadge.textContent = ' (BANNED)';
        bannedBadge.style.color = '#ff4d4f';
        bannedBadge.style.fontWeight = 'bold';
        uname.appendChild(bannedBadge);
    }
    details.appendChild(uname);
    const meta = document.createElement('div');
    meta.className = 'user-meta';
    meta.innerHTML =
        (user.email ? `<b>Email:</b> ${user.email} <br>` : '') +
        `<b>UID:</b> ${user.uid}` +
        (user.lastActive ? `<br><b>Last active:</b> ${formatTime(user.lastActive)}` : '');
    details.appendChild(meta);
    li.appendChild(details);
    // Actions
    const actions = document.createElement('div');
    actions.className = 'user-actions';
    // View Messages
    const viewMsgBtn = document.createElement('button');
    viewMsgBtn.textContent = 'View Messages';
    viewMsgBtn.className = 'view-messages-btn';
    viewMsgBtn.onclick = function() { showMessagesModal(user); };
    actions.appendChild(viewMsgBtn);
    // Ban/Unban
    const banBtn = document.createElement('button');
    banBtn.textContent = user.banned ? 'Unban' : 'Ban';
    banBtn.className = user.banned ? 'unban-btn' : 'ban-btn';
    banBtn.onclick = function() {
        const action = user.banned ? 'unban' : 'ban';
        if (confirm(`Are you sure you want to ${action} this user?`)) {
            db.ref('users/' + user.uid + '/banned').set(!user.banned, function(err) {
                if (err) showToast('Error updating ban status', false);
                else showToast(user.banned ? 'User unbanned!' : 'User banned!');
            });
        }
    };
    actions.appendChild(banBtn);
    // Edit
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'edit-btn';
    editBtn.onclick = function() {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = user.username || '';
        input.className = 'edit-input';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'save-btn';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'cancel-btn';
        actions.innerHTML = '';
        actions.appendChild(input);
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        saveBtn.onclick = function() {
            const newName = input.value.trim();
            if (!newName) return showToast('Username required', false);
            db.ref('users').orderByChild('username').equalTo(newName).once('value', function(snapshot) {
                if (snapshot.exists() && Object.keys(snapshot.val()).find(uid => uid !== user.uid)) {
                    showToast('Username already taken', false);
                } else {
                    if (confirm('Change username to "' + newName + '"?')) {
                        db.ref('users/' + user.uid + '/username').set(newName, function(err) {
                            if (err) showToast('Error saving username', false);
                            else showToast('Username updated!');
                        });
                    }
                }
            });
        };
        cancelBtn.onclick = function() { renderAllUsers(); };
    };
    actions.appendChild(editBtn);
    // Delete
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.className = 'delete-btn';
    delBtn.onclick = function() {
        if (confirm('Delete this user profile?')) {
            db.ref('users/' + user.uid).remove(function(err) {
                if (err) showToast('Error deleting user', false);
                else showToast('User deleted!');
            });
        }
    };
    actions.appendChild(delBtn);
    li.appendChild(actions);
    return li;
}

function filterAndSortUsers() {
    filteredUsers = allUsers.filter(u =>
        !searchTerm || (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    if (sortMode === 'az') filteredUsers.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
    else if (sortMode === 'za') filteredUsers.sort((a, b) => (b.username || '').localeCompare(a.username || ''));
    else if (sortMode === 'created') filteredUsers.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function renderAllUsers() {
    userList.innerHTML = '';
    filterAndSortUsers();
    filteredUsers.forEach(user => userList.appendChild(renderUser(user)));
}

function fetchUsers() {
    db.ref('users').on('value', function(snapshot) {
        allUsers = [];
        snapshot.forEach(function(child) {
            const val = child.val();
            allUsers.push({
                uid: child.key,
                username: val.username,
                email: val.email || '',
                createdAt: val.createdAt || 0,
                lastActive: val.lastActive || 0,
                banned: val.banned || false
            });
        });
        renderAllUsers();
    });
}

searchInput.addEventListener('input', function() {
    searchTerm = searchInput.value;
    renderAllUsers();
});
sortSelect.addEventListener('change', function() {
    sortMode = sortSelect.value;
    renderAllUsers();
});

// Infinite scroll (if needed for large lists)
userList.addEventListener('scroll', function() {
    // Placeholder for pagination logic if needed
});

function showEmailsModal() {
    emailsListModal.innerHTML = '';
    allUsers.forEach(user => {
        if (user.email) {
            const li = document.createElement('li');
            li.textContent = user.email;
            emailsListModal.appendChild(li);
        }
    });
    emailsModal.style.display = 'flex';
}
if (showEmailsBtn) {
    showEmailsBtn.onclick = function() {
        showEmailsModal();
    };
}
if (closeEmailsModalBtn) {
    closeEmailsModalBtn.onclick = function() {
        emailsModal.style.display = 'none';
    };
}

function showMessagesModal(user) {
    messagesListModal.innerHTML = '';
    // Fetch all messages sent or received by this user using the same db instance
    db.ref('messages').orderByChild('timestamp').once('value', function(snapshot) {
        const msgs = [];
        snapshot.forEach(function(child) {
            const val = child.val();
            if (val.uid === user.uid || val.to === user.uid) {
                msgs.push({
                    sender: allUsers.find(u => u.uid === val.uid)?.username || val.username || val.uid,
                    recipient: val.to ? (allUsers.find(u => u.uid === val.to)?.username || val.to) : 'Public',
                    message: val.message,
                    time: formatTime(val.timestamp)
                });
            }
        });
        if (msgs.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No messages found.';
            messagesListModal.appendChild(li);
        } else {
            msgs.forEach(msg => {
                const li = document.createElement('li');
                li.innerHTML = `<div><b>From:</b> ${msg.sender}</div><div><b>To:</b> ${msg.recipient}</div><div>${msg.message}</div><div class="msg-meta">${msg.time}</div>`;
                messagesListModal.appendChild(li);
            });
        }
        messagesModal.style.display = 'flex';
    });
}
if (closeMessagesModalBtn) {
    closeMessagesModalBtn.onclick = function() {
        messagesModal.style.display = 'none';
    };
}

fetchUsers(); 