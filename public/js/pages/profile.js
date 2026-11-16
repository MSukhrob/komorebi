import {
  initPage, api, html, raw, $, $$, toast, draw, stateHtml, retryButton, entryRow, avatar,
  friendButtons, wireFriendButtons, PRIVACY_LABELS, activateTab, placePill,
} from '../app.js';

const viewer = await initPage();
const box = $('#profile');
const username = decodeURIComponent(location.pathname.split('/').pop());
const state = { status: 'all', type: 'all', sort: 'added' };

const joined = (date) => new Date(date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

// A shoji screen: the picture shown instead of a list that is not for you.
const SHOJI = `<svg viewBox="0 0 360 250" role="img" aria-label="A closed paper shoji screen with a warm light behind it">
  <circle class="shoji-glow" cx="296" cy="44" r="38"/>
  <rect class="shoji-paper" x="44" y="28" width="136" height="190"/>
  <rect class="shoji-paper" x="180" y="28" width="136" height="190"/>
  <path class="shoji-lattice" d="M89.3 28v190M134.7 28v190M225.3 28v190M270.7 28v190M44 66h272M44 104h272M44 142h272M44 180h272"/>
  <rect class="shoji-wood" x="40" y="24" width="280" height="198" rx="4"/>
  <path class="shoji-wood" d="M180 24v198M44 218h272"/>
  <path class="shoji-leaf" d="M62 238c-2-9 3-16 14-17 1 9-4 16-14 17Z"/>
  <path class="shoji-leaf" d="M82 238c1-8 7-13 16-12-1 8-7 13-16 12Z"/>
</svg>`;

let current = null; // { profile, hidden, reason }
let firstDraw = true;

/* ---------- Pieces ---------- */
function headerHtml(profile, hidden) {
  const self = profile.relationship === 'self';
  return html`<header class="profile-head">
    <div class="profile-id">
      ${avatar(profile.username, 'avatar-lg')}
      <div>
        <h1>${profile.username}</h1>
        <p>Joined ${joined(profile.createdAt)}${self ? html`. Your list is <strong>${PRIVACY_LABELS[profile.privacy].toLowerCase()}</strong>.` : ''}</p>
      </div>
    </div>
    <div class="profile-actions" id="profile-actions">
      ${hidden ? '' : friendButtons(profile, { loggedIn: !!viewer })}
      <button class="btn btn-quiet btn-sm" type="button" id="copy-link">Copy link</button>
    </div>
  </header>`;
}

function countsHtml(c) {
  return html`<ul class="counts" aria-label="List counts">
    <li><strong>${c.all}</strong><span>titles</span></li>
    <li><strong>${c.planned}</strong><span>planned</span></li>
    <li><strong>${c.watching}</strong><span>watching</span></li>
    <li><strong>${c.watched}</strong><span>watched</span></li>
  </ul>`;
}

function controls() {
  const tab = (v, label) => html`<button type="button" data-status="${v}" class="${state.status === v ? 'is-active' : ''}" aria-pressed="${String(state.status === v)}">${label}</button>`;
  return html`<div class="toolbar"><div class="pill-nav" id="tabs" role="group" aria-label="Show by status"><span class="pill" aria-hidden="true"></span>
      ${tab('all', 'All')}${tab('planned', 'Planned')}${tab('watching', 'Watching')}${tab('watched', 'Watched')}
    </div>
    <form class="filters" id="filters">
      <div class="field"><label for="f-type">Type</label>
        <select id="f-type" name="type">
          <option value="all">All types</option><option value="movie">Movies</option><option value="series">Series</option>
          <option value="cartoon">Cartoons</option>
        </select></div>
      <div class="field"><label for="f-sort">Sort by</label>
        <select id="f-sort" name="sort"><option value="added">Date added</option><option value="rating">Rating</option><option value="title">Title</option></select></div>
    </form></div>`;
}

// The gate: calm words and a way forward, never a cold error.
function gateHtml({ profile, reason }) {
  const name = profile.username;
  const rel = profile.relationship;
  let title;
  let text = '';
  let actions = '';
  if (reason === 'private') {
    title = `${name} keeps their watchlist private.`;
    text = `Only ${name} can see it.`;
  } else {
    title = `${name} keeps their watchlist open to friends only.`;
    if (reason === 'login') {
      text = 'Log in and send a friend request to see what they are watching.';
      actions = html`<a class="btn" href="/login?next=${encodeURIComponent(location.pathname)}">Log in to send a friend request</a>`;
    } else {
      text = {
        outgoing: `Your request is waiting for ${name} to answer.`,
        incoming: `${name} has already sent you a request. Accept it to see each other's lists.`,
      }[rel] || 'Send a friend request to see what they are watching.';
      actions = friendButtons(profile, { addLabel: 'Send friend request' });
    }
  }
  return html`<section class="gate" role="status">${raw(SHOJI)}<h2>${title}</h2><p>${text}</p>
    <div class="btn-row">${actions}</div></section>`;
}

function emptyText(profile, counts) {
  const self = profile.relationship === 'self';
  if (!counts.all) {
    return stateHtml('empty', self ? 'Your list is empty' : `${profile.username} has not added anything yet`,
      self ? 'Find something to watch and add it.' : '', self ? html`<a class="btn" href="/">Search titles</a>` : '');
  }
  return stateHtml('empty', 'Nothing matches these filters', 'Try another tab or type.');
}

/* ---------- Loading ---------- */
async function load() {
  const listBox = $('#profile-list');
  if (listBox) draw(listBox, stateHtml('loading', 'Loading list…'));
  let data;
  try {
    data = await api(`/api/users/${encodeURIComponent(username)}?${new URLSearchParams(state)}`);
  } catch (err) {
    draw(box, err.status === 404
      ? stateHtml('empty', 'No one here', 'There is no one with this username. Check the link.', html`<a class="btn" href="/friends">Find people</a>`)
      : stateHtml('error', 'This profile could not load', err.message, retryButton()));
    return;
  }

  if (data.hidden) {
    // hidden list: the server sends only the name, relationship and the reason
    document.title = `${data.profile.username} | Komorebi`;
    current = { profile: data.profile, hidden: true, reason: data.reason };
    draw(box, html`${headerHtml(data.profile, true)}<div id="gate">${gateHtml(current)}</div>`);
    firstDraw = true;
    return;
  }

  const { profile, entries, counts } = data;
  current = { profile, hidden: false };
  if (firstDraw) {
    document.title = `${profile.username} | Komorebi`;
    draw(box, html`${headerHtml(profile, false)}<div id="counts"></div>${controls()}<div id="profile-list" aria-live="polite"></div>`);
    $('#f-type').value = state.type;
    $('#f-sort').value = state.sort;
    placePill($('#tabs'), false);
    firstDraw = false;
  }
  if (state.type === 'all') $('#counts').innerHTML = countsHtml(counts).toString();
  draw($('#profile-list'), entries.length
    ? html`<ul class="entries cascade">${entries.map((e) => entryRow(e))}</ul>`
    : emptyText(profile, counts));
}

/* ---------- Events ---------- */
box.addEventListener('click', async (e) => {
  const tab = e.target.closest('#tabs button');
  if (tab) {
    state.status = tab.dataset.status;
    activateTab($('#tabs'), tab);
    load();
    return;
  }
  if (e.target.id === 'copy-link') {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Profile link copied.');
    } catch {
      toast(`Copy this link: ${location.href}`);
    }
  }
});
box.addEventListener('change', (e) => {
  if (!e.target.closest('#filters')) return;
  state[e.target.name] = e.target.value;
  load();
});

// After a friend action. If the list may have become visible or hidden (the two of you are
// now friends, or no longer are), draw everything again. Otherwise only the buttons change,
// in place: "Send friend request" becomes "Request sent ✓" without reloading the page.
wireFriendButtons(box, (result) => {
  const wasFriends = current.profile.relationship === 'friends';
  current.profile.relationship = result.relationship;
  if (result.relationship === 'friends' || wasFriends) {
    firstDraw = true;
    load();
  } else if (current.hidden) {
    $('#gate').innerHTML = gateHtml(current).toString();
  } else {
    const actions = $('#profile-actions');
    actions.innerHTML = html`${friendButtons(current.profile, { loggedIn: !!viewer })}<button class="btn btn-quiet btn-sm" type="button" id="copy-link">Copy link</button>`.toString();
  }
});

load();
