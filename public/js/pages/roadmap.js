import { initPage, html, raw, $, draw, ICONS } from '../app.js';

await initPage({ nav: '' });

const ICON = (inner) => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`);
const star = ICON('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9-4.3-4.1 5.9-.8z"/>');
const I = {
  import: ICON('<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>'),
  where: ICON('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  bell: ICON('<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>'),
  list: ICON('<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
  together: ICON('<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c.5-3.5 2.7-5.5 5.5-5.5s5 2 5.5 5.5M14.5 14.8c2.6-.5 5.3 1 6 5.2"/>'),
  spark: ICON('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>'),
  globe: ICON('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'),
  phone: ICON('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
  chat: ICON('<path d="M4 5h16v11H9l-5 4z"/>'),
  gift: ICON('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-2-4-6-3-5 0 .5 1.5 3 1.5 5 0zM12 8c2-4 6-3 5 0-.5 1.5-3 1.5-5 0z"/>'),
  shield: ICON('<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  calendar: ICON('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
};

const GROUPS = [
  { title: 'Next up', note: 'Planned for the coming weeks', status: 'next', label: 'Next up', items: [
    [I.import, 'Import your history', 'Bring your lists from Trakt, Letterboxd, IMDb and Netflix history files in one step, with a preview before anything is saved.'],
    [I.where, 'Where to watch', 'See which streaming services carry a title in your country, with links straight to them.'],
    [I.bell, 'New-episode reminders', 'An email or a push message when a show on your list has a new episode or a movie reaches cinemas.'],
    [I.calendar, 'Release calendar', 'A calendar of upcoming episodes and premieres for your list, plus an iCal link for your phone.'],
  ] },
  { title: 'Later', note: 'Designed, waiting for their turn', status: 'later', label: 'Later', items: [
    [I.list, 'Custom lists', 'Make your own collections like "Rainy Sunday movies" and share them with a link.'],
    [I.together, 'Watch together', 'Start a plan with friends: vote on a title, pick a time and see who is in.'],
    [I.spark, 'Recommendations', 'Suggestions based on what you and your friends rate highly.'],
    [I.globe, 'More languages', 'Uzbek and Russian next to English, with titles and descriptions in your language.'],
    [I.phone, 'Offline and push', 'Komorebi can already be added to your phone\'s home screen. Next: your list offline, and push messages.'],
  ] },
  { title: 'Ideas', note: 'Worth exploring', status: 'idea', label: 'Idea', items: [
    [I.chat, 'Comments and likes', 'React to a friend\'s review or start a short conversation under it.'],
    [I.gift, 'Year in review', 'A yearly summary of hours watched, favourite genres and your highest-rated titles.'],
    [star, 'Episode ratings', 'Rate single episodes and see how a series gets better or worse across its seasons.'],
    [I.shield, 'Safer accounts', 'Email verification, password reset and two-step login.'],
  ] },
];

draw($('#road'), html`${GROUPS.map((g) => html`<section class="road-group" aria-labelledby="road-${g.status}">
  <div class="section-head"><h2 id="road-${g.status}">${g.title}</h2><p>${g.note}</p></div>
  <div class="road-grid cascade">${g.items.map(([icon, title, text]) => html`<article class="road-card">
    <span class="road-icon">${icon}</span>
    <h3>${title}</h3><p>${text}</p>
    <span class="road-status road-${g.status}">${g.label}</span>
  </article>`)}</div></section>`)}`);
