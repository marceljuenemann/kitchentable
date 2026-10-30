import { randomUUID } from 'node:crypto';
import { expect, Page, test } from '@playwright/test';
import {
  createMember,
  jpeg,
  profileOf,
  signIn,
  signInAs,
  uploadPhoto,
  userIdOf,
} from './support/admin';

const MAYA = {
  name: 'Maya',
  tagline: 'Supper clubs, long tables, longer conversations',
  bio: 'I host a monthly supper club.\n\nI like people who ask a second question.',
  gender: ['Woman'],
  birth_year: 1991,
  birth_month: 4,
  looking_for: ['polyamory', 'friends'],
};
const IFE = {
  name: 'Ife',
  gender: ['Non-binary'],
  birth_year: 1988,
  birth_month: 11,
  looking_for: ['relationship-anarchy', 'friends'],
};
const DEVI = {
  name: 'Devi',
  gender: ['Woman'],
  birth_year: 1983,
  birth_month: 7,
  looking_for: ['open-relationship', 'Slow dating'],
};
const TOBY = {
  name: 'Toby',
  gender: ['Man'],
  birth_year: 1979,
  birth_month: 12,
  looking_for: ['exploring', 'monogamy'],
};
const NOUR = {
  name: 'Nour',
  gender: ['Man', 'Gender questioning'],
  birth_year: 1994,
  birth_month: 3,
  looking_for: ['polyamory', 'play-partners'],
};
const SAM = {
  name: 'Sam',
  gender: ['Agender', 'Neutrois'],
  birth_year: 1999,
  birth_month: 8,
  looking_for: ['friends', 'Solo poly'],
};
const ALEX = {
  name: 'Alex',
  gender: ['Non-binary'],
  looking_for: ['relationship-anarchy', 'play-partners'],
};

/**
 * Signs in as a member who can find exactly these people: all of them live in a place of this
 * test's own, so other tests and what's left in the database don't show up.
 */
async function searchAmong(page: Page, members: Record<string, unknown>[]) {
  const location = `Testville ${randomUUID()}`;
  const created = await Promise.all(members.map((fields) => createMember({ location, ...fields })));
  const email = await signInAs(page, 'active', { location });
  return { email, location, ids: created.map(({ id }) => id) };
}

const tile = (page: Page, name: string) =>
  page.locator('app-profile-grid').getByRole('link', { name: new RegExp(`^${name}\\b`) });

/** Whether the image has really loaded, rather than failing to. */
const loaded = (image: ReturnType<Page['locator']>) =>
  image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0);

test('filters narrow the grid as options are switched', async ({ page }) => {
  await searchAmong(page, [MAYA, IFE, DEVI, TOBY, NOUR, SAM, ALEX]);
  await expect(page.getByText('7 people found')).toBeVisible();

  await page.getByRole('button', { name: 'Gender, any' }).click();
  const sheet = page.locator('mat-bottom-sheet-container');
  const onlyShowMe = sheet.getByRole('switch', { name: /Only show me to these genders/ });
  await expect(onlyShowMe).toBeDisabled();
  const man = sheet.getByRole('option', { name: 'Man', exact: true });
  await man.click();
  await expect(man).toHaveAttribute('aria-selected', 'true');
  await sheet.getByRole('option', { name: 'Non-binary' }).click();
  // Live, behind the sheet: Toby and Nour are men; Ife and Alex non-binary.
  await expect(page.getByText('4 people found')).toBeVisible();
  await onlyShowMe.click();
  await expect(onlyShowMe).toHaveAttribute('aria-checked', 'true');
  await sheet.getByRole('button', { name: 'Show 4 people' }).click();
  await expect(sheet).toBeHidden();

  const genderPill = page.getByRole('button', { name: 'Gender, Non-binary, Man' });
  await expect(genderPill).toHaveAttribute('aria-pressed', 'true');
  await expect(tile(page, 'Toby')).toBeVisible();
  await expect(tile(page, 'Maya')).toBeHidden();

  // Across fields, people must match both: of those four, only Ife is looking for friends.
  await page.getByRole('button', { name: 'Looking for, any' }).click();
  await sheet.getByRole('option', { name: 'Friends' }).click();
  await expect(sheet.getByRole('button', { name: 'Show 1 person' })).toBeVisible();
  await sheet.getByRole('option', { name: 'Friends' }).click();
  await sheet.getByRole('option', { name: 'Play partners' }).click();
  // Nour and Alex.
  await expect(page.getByText('2 people found')).toBeVisible();
  await sheet.getByRole('button', { name: 'Show 2 people' }).click();
  await expect(sheet).toBeHidden();

  // Alex didn't give an age, so shows until that's switched off, even with any age.
  await page.getByRole('button', { name: 'Age, any' }).click();
  const unspecifiedAge = sheet.getByRole('switch', { name: 'Include profiles with no age' });
  await expect(unspecifiedAge).toHaveAttribute('aria-checked', 'true');
  await unspecifiedAge.click();
  await expect(page.getByText('1 person found')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  const agePill = page.getByRole('button', { name: 'Age, any, not profiles with no age' });
  await expect(agePill).toHaveAttribute('aria-pressed', 'true');

  // Nour isn't in his 20s.
  await agePill.click();
  await sheet.getByRole('slider', { name: 'Oldest' }).fill('29');
  await expect(sheet.getByText('18 to 29 years old')).toBeVisible();
  await expect(page.getByText('0 people found')).toBeVisible();
  await unspecifiedAge.click();
  await expect(page.getByText('1 person found')).toBeVisible();
  // Clear clears only the filter whose sheet is open, and closes it.
  await sheet.getByRole('button', { name: 'Clear' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: 'Age, any' })).toBeVisible();
  await expect(page.getByText('2 people found')).toBeVisible();

  // Self-described is for what people wrote themselves: Devi and Sam, once Gender is cleared.
  await page.getByRole('button', { name: 'Gender, Non-binary, Man' }).click();
  await sheet.getByRole('button', { name: 'Clear' }).click();
  await expect(sheet).toBeHidden();
  await page.getByRole('button', { name: 'Looking for, Play partners' }).click();
  await sheet.getByRole('option', { name: 'Play partners' }).click();
  await sheet.getByRole('option', { name: 'Self-described' }).click();
  await sheet.getByRole('button', { name: 'Show 2 people' }).click();
  await expect(tile(page, 'Devi')).toBeVisible();
  await expect(tile(page, 'Sam')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Looking for, Self-described' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Gender, any' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('the age range applies while its thumb is still being dragged', async ({ page }) => {
  await searchAmong(page, [MAYA, TOBY]);
  await expect(page.getByText('2 people found')).toBeVisible();
  await page.getByRole('button', { name: 'Age, any' }).click();
  const sheet = page.locator('mat-bottom-sheet-container');
  await expect(sheet.getByText('Any age')).toBeVisible();

  // The Oldest thumb starts at the right end. Grabbed once the sheet has stopped sliding in.
  const thumb = sheet.locator('.mdc-slider__thumb').nth(1);
  let knob = (await thumb.boundingBox())!;
  for (let attempt = 0; attempt < 30; attempt++) {
    await page.waitForTimeout(100);
    const current = (await thumb.boundingBox())!;
    if (current.y === knob.y) break;
    knob = current;
  }
  const y = knob.y + knob.height / 2;
  await page.mouse.move(knob.x + knob.width / 2, y);
  await page.mouse.down();
  // To about 38, below Toby.
  await page.mouse.move(knob.x + knob.width / 2 - 250, y, { steps: 10 });

  await expect(sheet.getByText(/^18 to 3\d years old$/)).toBeVisible();
  await expect(page.getByText('2 people found')).toBeHidden();
  await page.mouse.up();
});

test('the end of the grid asks to invite people, with a link to copy', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await searchAmong(page, []);

  await expect(page.getByText('0 people found')).toBeVisible();
  await expect(page.getByText("That's everyone for now")).toBeVisible();
  await expect(page.getByText(/^http:\/\/localhost:4200\/\?invite=[0-9a-f]{8}$/)).toBeVisible();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
});

test('shows the members of the same place, newest first', async ({ page }) => {
  await createMember({ ...DEVI, location: 'Elsewhere' });
  await searchAmong(page, [
    { ...MAYA, age_verified_at: '2026-10-01T00:00:00Z' },
    { ...TOBY, age_verified_at: '2026-10-03T00:00:00Z' },
    { ...SAM, age_verified_at: '2026-10-02T00:00:00Z' },
  ]);

  await expect(page.locator('app-profile-grid .name')).toHaveText(['Toby', 'Sam', 'Maya']);
});

test('a profile opens over the grid with its photos, and can be hidden and brought back', async ({
  page,
}) => {
  const photos = [randomUUID(), randomUUID(), randomUUID()];
  const {
    ids: [id],
  } = await searchAmong(page, [{ ...MAYA, photos }]);
  const image = await jpeg(page, '#c83897');
  for (const photo of photos) {
    await uploadPhoto(`${id}/${photo}/thumb.jpg`, image);
    await uploadPhoto(`${id}/${photo}/full.jpg`, image);
  }
  // Uploaded after the page first loaded search.
  await page.reload();

  await expect.poll(() => loaded(tile(page, 'Maya').locator('img'))).toBe(true);

  await tile(page, 'Maya').click();
  await page.waitForURL(`**/app/profiles/${id}`);
  await expect(page.getByRole('heading', { name: 'Maya', level: 1 })).toBeVisible();
  // Under the profile, Search stays the current tab, so the nav's pill doesn't move.
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Search' }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText(/^\d+ years old$/)).toBeVisible();
  await expect(page.getByText('I host a monthly supper club')).toBeVisible();
  // The full-size photos, of someone else: every one has really loaded.
  for (const name of ['Photo 1 of 3', 'Photo 2 of 3', 'Photo 3 of 3']) {
    await expect.poll(() => loaded(page.getByRole('img', { name }))).toBe(true);
  }

  // Reaching out isn't built yet.
  await page.getByRole('button', { name: 'Reach out' }).click();
  await expect(page.getByText("Reaching out isn't ready yet")).toBeVisible();

  await page.getByRole('button', { name: 'Hide profile' }).click();
  await page.waitForURL((url) => url.pathname === '/app');
  await expect(page.getByText("Maya won't show up again")).toBeVisible();
  await expect(tile(page, 'Maya')).toBeHidden();
  await expect(page.getByText('0 people found')).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(tile(page, 'Maya')).toBeVisible();
  await expect(page.getByText('1 person found')).toBeVisible();
});

test('a profile opens by its URL, unless the member may not see it', async ({ page }) => {
  const {
    ids: [id],
  } = await searchAmong(page, [MAYA]);

  await page.goto(`/app/profiles/${id}`);
  await expect(page.getByRole('heading', { name: 'Maya', level: 1 })).toBeVisible();

  const { id: elsewhere } = await createMember({ ...DEVI, location: 'Elsewhere' });
  await page.goto(`/app/profiles/${elsewhere}`);
  await expect(page.getByText("This profile isn't available.")).toBeVisible();
});

test('a tile swiped left is hidden for good, and a short swipe neither hides nor opens it', async ({
  page,
}) => {
  await searchAmong(page, [
    { ...MAYA, age_verified_at: '2026-10-01T00:00:00Z' },
    { ...TOBY, age_verified_at: '2026-10-02T00:00:00Z' },
  ]);
  // The newest member, so the first tile, in view.
  const toby = tile(page, 'Toby');
  await expect(toby).toBeVisible();
  const box = (await toby.boundingBox())!;
  // From the middle, which is still on the tile while it springs back from the swipe before.
  const swipe = async (distance: number) => {
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - distance, y, { steps: 8 });
    await page.mouse.up();
  };

  await swipe(40);
  await expect(page).toHaveURL('/app');
  await expect(page.getByText('2 people found')).toBeVisible();

  const dismissed = page.waitForResponse('**/rest/v1/rpc/set_dismissed');
  await swipe(120);
  await expect(page.getByText("Toby won't show up again")).toBeVisible();
  await expect(toby).toBeHidden();
  await expect(page).toHaveURL('/app');

  await dismissed;
  await page.reload();
  await expect(page.getByText('1 person found')).toBeVisible();
  await expect(toby).toBeHidden();
});

test('someone who could not be hidden comes back', async ({ page }) => {
  await searchAmong(page, [MAYA]);
  await page.route('**/rest/v1/rpc/set_dismissed', (route) => route.abort());

  await tile(page, 'Maya').click();
  await page.getByRole('button', { name: 'Hide profile' }).click();

  await expect(page.getByText("Couldn't hide Maya")).toBeVisible();
  await expect(tile(page, 'Maya')).toBeVisible();
});

test('search can be tried again when it fails to load', async ({ page }) => {
  const search = '**/rest/v1/rpc/search_profiles';
  await page.route(search, (route) => route.abort());
  await searchAmong(page, [MAYA]);

  await expect(page.getByText('Something went wrong loading search.')).toBeVisible();

  await page.unroute(search);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(tile(page, 'Maya')).toBeVisible();
});

test('the filters stay while visiting another tab', async ({ page }) => {
  await searchAmong(page, [SAM, TOBY]);

  await page.getByRole('button', { name: 'Gender, any' }).click();
  await page.locator('mat-bottom-sheet-container').getByRole('option', { name: 'Agender' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('1 person found')).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Messages' }).click();
  await nav.getByRole('link', { name: 'Search' }).click();
  await expect(page.getByText('1 person found')).toBeVisible();
});

test('the filters and the switch are saved on the profile and survive signing out', async ({
  page,
}) => {
  const { email } = await searchAmong(page, [SAM, TOBY]);
  const saved = async () => {
    const profile = await profileOf(await userIdOf(email));
    return { filters: profile.search_filters, hide: profile.hide_by_gender };
  };

  await page.getByRole('button', { name: 'Gender, any' }).click();
  const sheet = page.locator('mat-bottom-sheet-container');
  await sheet.getByRole('option', { name: 'Agender' }).click();
  await sheet.getByRole('switch', { name: /Only show me to these genders/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('1 person found')).toBeVisible();
  await expect.poll(saved).toEqual({
    filters: {
      looking_for: [],
      gender: ['Agender'],
      min_age: 18,
      max_age: 70,
      show_unspecified_age: true,
    },
    hide: true,
  });

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Your profile' })
    .click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('/');

  await signIn(page, email);
  await expect(page.getByText('1 person found')).toBeVisible();
  await page.getByRole('button', { name: 'Gender, Agender' }).click();
  await expect(
    sheet.getByRole('switch', { name: /Only show me to these genders/ }),
  ).toHaveAttribute('aria-checked', 'true');
});

test('filters that could not be saved can be retried', async ({ page }) => {
  const { email } = await searchAmong(page, [SAM, TOBY]);
  const rpc = '**/rest/v1/rpc/set_search_filters';
  await page.route(rpc, (route) => route.abort());

  await page.getByRole('button', { name: 'Gender, any' }).click();
  await page.locator('mat-bottom-sheet-container').getByRole('option', { name: 'Agender' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText("Couldn't save your filters")).toBeVisible();
  // Search carries on regardless.
  await expect(page.getByText('1 person found')).toBeVisible();

  await page.unroute(rpc);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect
    .poll(async () => (await profileOf(await userIdOf(email))).search_filters)
    .toMatchObject({ gender: ['Agender'] });
});
