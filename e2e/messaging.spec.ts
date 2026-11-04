import { randomUUID } from 'node:crypto';
import { Browser, expect, Page, test } from '@playwright/test';
import {
  createIntro,
  createMember,
  jpeg,
  secretOf,
  setStatus,
  signIn,
  signInAs,
  uploadPhoto,
  userIdOf,
} from './support/admin';

// Connections and messages go through the local database and its sync (see "Messaging sync" in
// docs/database.md), so each test signs both people in, in browsers of their own.

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const composer = (page: Page, name: string) =>
  page.getByRole('textbox', { name: `Message to ${name}` });
/** The open conversation, rather than the list behind it, which has the latest message too. */
const thread = (page: Page) => page.locator('app-conversation');

async function send(page: Page, name: string, text: string) {
  await composer(page, name).fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}

/** Maya and Ife, with an intro from Maya, each signed in to a page of their own. */
async function pair(page: Page, browser: Browser, status: 'pending' | 'accepted') {
  const location = `Testville ${randomUUID()}`;
  const maya = await createMember({ name: 'Maya', location, looking_for: ['friends'] });
  const ife = await createMember({ name: 'Ife', location, looking_for: ['friends'] });
  await createIntro(maya.id, ife.id, 'Hi Ife, fancy a walk on the Heath?', status);
  await signIn(page, ife.email);
  const mayaPage = await browser.newPage();
  await signIn(mayaPage, maya.email);
  return { maya, ife, mayaPage };
}

test('an introduction sent from search becomes a conversation once accepted', async ({
  page,
  browser,
}) => {
  const location = `Testville ${randomUUID()}`;
  const maya = await createMember({ name: 'Maya', location, looking_for: ['friends'] });
  await signInAs(page, 'active', { location });

  await page
    .locator('app-profile-grid')
    .getByRole('link', { name: /^Maya\b/ })
    .click();
  await page.getByRole('button', { name: 'Reach out' }).click();
  const sheet = page.locator('mat-bottom-sheet-container');
  await sheet.getByRole('textbox').fill('Hi Maya! Your supper club sounds lovely.');
  await sheet.getByRole('button', { name: 'Send introduction' }).click();
  await expect(page.getByText('Introduction sent to Maya')).toBeVisible();

  const mayaPage = await browser.newPage();
  await signIn(mayaPage, maya.email);
  await expect(nav(mayaPage).getByRole('link', { name: 'Connections, 1 unread' })).toBeVisible();
  await nav(mayaPage)
    .getByRole('link', { name: /^Connections/ })
    .click();
  await mayaPage.getByRole('link', { name: 'View E2E User’s profile' }).click();
  // On the profile, rather than the tile behind it.
  await expect(
    mayaPage.locator('app-request-profile').getByText('Hi Maya! Your supper club sounds lovely.'),
  ).toBeVisible();
  await mayaPage.getByRole('button', { name: 'Connect' }).click();
  await mayaPage.waitForURL(/\/app\/messages\/[0-9a-f-]+$/);
  await expect(composer(mayaPage, 'E2E User')).toBeEnabled();

  // The sender hears about it straight away.
  await nav(page)
    .getByRole('link', { name: /^Messages/ })
    .click();
  await expect(page.getByText('Maya accepted your introduction')).toBeVisible();
  await mayaPage.close();
});

test('messages arrive live and count as unread until read', async ({ page, browser }) => {
  const { maya, mayaPage } = await pair(page, browser, 'accepted');

  await page.goto(`/app/messages/${maya.id}`);
  await expect(thread(page).getByText('Hi Ife, fancy a walk on the Heath?')).toBeVisible();
  await send(page, 'Maya', 'Yes please! Saturday?');
  await expect(thread(page).getByText('Yes please! Saturday?')).toBeVisible();
  await expect(page.getByText('Sending…')).toBeHidden();

  await expect(nav(mayaPage).getByRole('link', { name: 'Messages, 1 unread' })).toBeVisible();
  await nav(mayaPage)
    .getByRole('link', { name: /^Messages/ })
    .click();
  await mayaPage.getByRole('link', { name: /Yes please! Saturday\?/ }).click();
  await expect(mayaPage.getByText('New messages')).toBeVisible();

  // Ife still has the conversation open, so Maya's reply is read as it arrives.
  await send(mayaPage, 'Ife', 'Saturday it is');
  await expect(thread(page).getByText('Saturday it is')).toBeVisible();
  await page.getByRole('button', { name: 'Back to messages' }).click();
  await expect(nav(page).getByRole('link', { name: 'Messages', exact: true })).toBeVisible();

  await mayaPage.getByRole('button', { name: 'Back to messages' }).click();
  await expect(nav(mayaPage).getByRole('link', { name: 'Messages', exact: true })).toBeVisible();
  await mayaPage.close();
});

test('a message written offline is sent once back online', async ({ page, browser }) => {
  const { maya, mayaPage } = await pair(page, browser, 'accepted');
  await page.goto(`/app/messages/${maya.id}`);
  await expect(composer(page, 'Maya')).toBeEnabled();

  await page.context().setOffline(true);
  await send(page, 'Maya', 'Written on the Underground');
  await expect(thread(page).getByText('Written on the Underground')).toBeVisible();
  await expect(page.getByText('Sending…')).toBeVisible();

  await page.context().setOffline(false);
  await expect(page.getByText('Sending…')).toBeHidden();
  await nav(mayaPage)
    .getByRole('link', { name: /^Messages/ })
    .click();
  await expect(mayaPage.getByText('Written on the Underground')).toBeVisible();
  await mayaPage.close();
});

test('a message the server refuses shows as not sent, and doesn’t hold up later ones', async ({
  page,
  browser,
}) => {
  const { maya, ife, mayaPage } = await pair(page, browser, 'accepted');
  await page.goto(`/app/messages/${maya.id}`);
  await expect(composer(page, 'Maya')).toBeEnabled();

  // Suspended members can't message.
  await setStatus(ife.id, 'suspended');
  await send(page, 'Maya', 'Are you there?');
  await expect(page.getByText('Not sent', { exact: true })).toBeVisible();

  await setStatus(ife.id, 'active');
  await send(page, 'Maya', 'Hello again');
  await expect(page.getByText('Sending…')).toBeHidden();
  await expect(page.getByText('Not sent', { exact: true })).toBeVisible();
  await nav(mayaPage)
    .getByRole('link', { name: /^Messages/ })
    .click();
  await expect(mayaPage.getByText('Hello again')).toBeVisible();
  await mayaPage.getByText('Hello again').click();
  await expect(thread(mayaPage).getByText('Are you there?')).toBeHidden();
  await mayaPage.close();
});

test('hiding an introduction can be undone, and then declines it privately', async ({
  page,
  browser,
}) => {
  const { maya, ife, mayaPage } = await pair(page, browser, 'pending');
  await mayaPage.close();
  await nav(page)
    .getByRole('link', { name: /^Connections/ })
    .click();

  const tile = page.getByRole('link', { name: 'View Maya’s profile' });
  await tile.click();
  await page.getByRole('button', { name: 'Hide profile' }).click();
  await expect(tile).toBeHidden();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(tile).toBeVisible();
  expect((await secretOf(ife.id, maya.id)).declined_at).toBeNull();

  await tile.click();
  await page.getByRole('button', { name: 'Hide profile' }).click();
  await expect(page.getByText("Hidden. Maya won't be told")).toBeVisible();
  await expect(page.getByText('No introductions')).toBeVisible();
  await expect
    .poll(async () => (await secretOf(ife.id, maya.id)).declined_at, { timeout: 10_000 })
    .not.toBeNull();
});

test('https links in messages open in a new tab, other text stays text', async ({
  page,
  browser,
}) => {
  const { maya, mayaPage } = await pair(page, browser, 'accepted');
  await mayaPage.close();
  await page.goto(`/app/messages/${maya.id}`);

  const text = 'Menu: https://example.com/menu?day=sat.\nNot http://example.com though';
  await send(page, 'Maya', text);
  const bubble = thread(page).locator('.bubble', { hasText: 'Menu:' });
  await expect(bubble).toBeVisible();
  // Exactly as written: no whitespace from the template.
  expect(await bubble.evaluate((element) => element.textContent)).toBe(text);

  const links = bubble.getByRole('link');
  await expect(links).toHaveCount(1);
  await expect(links).toHaveText('https://example.com/menu?day=sat');
  await expect(links).toHaveAttribute('href', 'https://example.com/menu?day=sat');
  await expect(links).toHaveAttribute('target', '_blank');
  await expect(links).toHaveAttribute('rel', 'noopener noreferrer');
});

test('ending a connection shows on both sides', async ({ page, browser }) => {
  const { maya, mayaPage } = await pair(page, browser, 'accepted');
  await page.goto(`/app/messages/${maya.id}`);

  await page.getByRole('button', { name: 'More about this conversation' }).click();
  const sheet = page.locator('mat-bottom-sheet-container');
  await sheet.getByRole('button', { name: 'End connection' }).click();
  await sheet.getByRole('button', { name: 'End connection' }).click();
  await expect(page.getByText('This connection has ended.')).toBeVisible();
  await expect(composer(page, 'Maya')).toBeHidden();

  await nav(mayaPage)
    .getByRole('link', { name: /^Messages/ })
    .click();
  await expect(mayaPage.getByText('Ife ended this connection')).toBeVisible();
  await mayaPage.close();
});

test('the profile of someone you’re connected with shows all their photos', async ({ page }) => {
  await page.goto('/');
  const image = await jpeg(page, '#6cc3a0');
  const location = `Testville ${randomUUID()}`;
  /** A member with three photos, who has sent Ife an intro. */
  async function withPhotos(name: string, ifeId: string, status: 'pending' | 'accepted') {
    const photos = [randomUUID(), randomUUID(), randomUUID()];
    const member = await createMember({ name, location, looking_for: ['friends'], photos });
    for (const photo of photos) {
      await uploadPhoto(`${member.id}/${photo}/full.jpg`, image);
      await uploadPhoto(`${member.id}/${photo}/thumb.jpg`, image);
    }
    await createIntro(member.id, ifeId, `Hi Ife, it’s ${name}`, status);
    return member;
  }
  const ife = await createMember({ name: 'Ife', location, looking_for: ['friends'] });
  const maya = await withPhotos('Maya', ife.id, 'accepted');
  const toby = await withPhotos('Toby', ife.id, 'pending');
  await signIn(page, ife.email);
  const profile = page.locator('app-profile-view');
  const loaded = (name: string) =>
    profile
      .getByRole('img', { name })
      .evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0);

  // From a conversation.
  await page.goto(`/app/messages/${maya.id}/profile`);
  await expect.poll(() => loaded('Photo 3 of 3')).toBe(true);

  // From an introduction in Connections.
  await page.goto(`/app/connections/${toby.id}`);
  await expect.poll(() => loaded('Photo 3 of 3')).toBe(true);
});

test('signing out deletes the local copy of messages', async ({ page }) => {
  const email = await signInAs(page, 'active');
  const id = await userIdOf(email);
  const hasLocalData = () =>
    page.evaluate(
      async (name) => (await indexedDB.databases()).some((db) => db.name?.includes(name)),
      `kt-${id}`,
    );

  await page.goto('/app/messages');
  await expect.poll(hasLocalData).toBe(true);

  await page.goto('/app/profile');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await expect.poll(hasLocalData).toBe(false);
});
