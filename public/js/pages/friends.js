import {
  initPage, api, html, $, draw, stateHtml, retryButton, wireFriendButtons, personRow,
} from '../app.js';

await initPage({ nav: 'friends', requireLogin: true });

function listOrEmpty(people, relationship, emptyText) {
  return people.length
    ? html`<ul class="people cascade">${people.map((p) => personRow({ ...p, relationship }))}</ul>`
    : html`<p class="small-empty">${emptyText}</p>`;
}

/* ---------- My friends and requests ---------- */
async function loadFriends() {
  ['#incoming', '#friends', '#outgoing'].forEach((s) => {
    if (!$(s).children.length) draw($(s), stateHtml('loading', 'Loading…'));
  });
  try {
    const { friends, incoming, outgoing } = await api('/api/friends');
    draw($('#incoming'), listOrEmpty(incoming, 'incoming', 'No requests right now.'));
    draw($('#friends'), listOrEmpty(friends, 'friends', 'No friends yet. Find people by their username and send a request.'));
    draw($('#outgoing'), listOrEmpty(outgoing, 'outgoing', 'You have no requests waiting for an answer.'));
    $('#incoming-title').textContent = incoming.length ? `Requests for you (${incoming.length})` : 'Requests for you';
    $('#friends-title').textContent = friends.length ? `My friends (${friends.length})` : 'My friends';
  } catch (err) {
    draw($('#friends'), stateHtml('error', 'Friends could not load', err.message, retryButton()));
    $('#incoming').innerHTML = '';
    $('#outgoing').innerHTML = '';
  }
}

/* ---------- Find people ---------- */
const input = $('#people-q');
const results = $('#people');
let timer;
let lastQuery = '';

async function searchPeople() {
  const q = input.value.trim();
  lastQuery = q;
  if (q.length < 2) {
    results.innerHTML = '<p class="small-empty">Type a username to find someone.</p>';
    return;
  }
  try {
    const { people } = await api(`/api/friends/search?q=${encodeURIComponent(q)}`);
    if (q !== lastQuery) return; // a newer search is running
    draw(results, people.length
      ? html`<ul class="people cascade">${people.map((p) => personRow(p))}</ul>`
      : html`<p class="small-empty">No one is called “${q}”. Check the spelling.</p>`);
  } catch (err) {
    results.innerHTML = html`<p class="notice">${err.message}</p>`.toString();
  }
}

input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(searchPeople, 300);
});
$('#people-form').addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(timer);
  searchPeople();
});

// Any friend button on the page: refresh both columns afterwards.
wireFriendButtons($('#friends-layout'), () => {
  loadFriends();
  if (input.value.trim().length >= 2) searchPeople();
});

loadFriends();
searchPeople();
