import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { Member } from '../../../core/profile.model';
import { UserStorage } from '../../../core/user-storage';
import { ReachOutSheetComponent } from './reach-out-sheet.component';
import { SearchStore } from './search.store';

describe('ReachOutSheetComponent', () => {
  const member = {
    id: 'ivy',
    name: 'Ivy',
    looking_for: ['polyamory', 'Something of my own'],
  } as Member;
  let storage: Map<string, unknown>;
  let sendIntro: jasmine.Spy;
  const introsRemaining = signal(3);
  let ref: { dismiss: jasmine.Spy; disableClose: boolean | undefined };

  function create(data: Partial<Member> = {}) {
    TestBed.configureTestingModule({
      imports: [ReachOutSheetComponent],
      providers: [
        { provide: MAT_BOTTOM_SHEET_DATA, useValue: { ...member, ...data } },
        { provide: MatBottomSheetRef, useValue: ref },
        { provide: SearchStore, useValue: { sendIntro, introsRemaining } },
        {
          provide: UserStorage,
          useValue: {
            get: (key: string) => storage.get(key) ?? null,
            set: (key: string, value: unknown) => storage.set(key, value),
            remove: (key: string) => storage.delete(key),
          },
        },
      ],
    });
    return TestBed.createComponent(ReachOutSheetComponent).componentInstance;
  }

  beforeEach(() => {
    storage = new Map();
    sendIntro = jasmine.createSpy('sendIntro').and.resolveTo();
    ref = { dismiss: jasmine.createSpy('dismiss'), disableClose: undefined };
    spyOn(console, 'warn');
  });

  it('offers what they are looking for, with their own words as they are', () => {
    expect(create().options.map(({ label }) => label)).toEqual([
      'Polyamory',
      'Something of my own',
    ]);
  });

  it('needs something to connect on and a message that is more than spaces', () => {
    const sheet = create();
    expect(sheet.canSend()).toBeFalse();
    expect(sheet.buttonLabel()).toBe('Select what to connect on');

    sheet.setPicked(['polyamory']);
    expect(sheet.canSend()).toBeFalse();
    expect(sheet.buttonLabel()).toBe('Write your message');

    sheet.setText('  \n ');
    expect(sheet.canSend()).toBeFalse();

    sheet.setText('Hello');
    expect(sheet.canSend()).toBeTrue();
    expect(sheet.buttonLabel()).toBe('Send introduction');

    sheet.setPicked([]);
    expect(sheet.canSend()).toBeFalse();
  });

  it('says how many introductions are left', () => {
    const sheet = create();
    introsRemaining.set(3);
    expect(sheet.introsLeft()).toBe('3 introductions left for today');
    introsRemaining.set(1);
    expect(sheet.introsLeft()).toBe('1 introduction left for today');
  });

  it('shows the count once the message nears the limit', () => {
    const sheet = create();
    sheet.setText('x'.repeat(649));
    expect(sheet.showCount()).toBeFalse();
    sheet.setText('x'.repeat(650));
    expect(sheet.showCount()).toBeTrue();
  });

  it('starts with the only option picked', () => {
    expect(create({ looking_for: ['friends'] }).picked()).toEqual(['friends']);
  });

  it('picks up a draft, without anything they no longer offer', () => {
    storage.set('intro.draft.ivy', { lookingFor: ['polyamory', 'friends'], text: 'Hel' });
    const sheet = create();
    expect(sheet.picked()).toEqual(['polyamory']);
    expect(sheet.text()).toBe('Hel');
  });

  it('sends the trimmed message, forgets the draft and closes', async () => {
    const sheet = create();
    sheet.setPicked(['polyamory']);
    sheet.setText(' Hello\n');
    expect(storage.has('intro.draft.ivy')).toBeTrue();

    await sheet.send();

    expect(sendIntro).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ id: 'ivy' }),
      ['polyamory'],
      'Hello',
    );
    expect(storage.has('intro.draft.ivy')).toBeFalse();
    expect(ref.dismiss).toHaveBeenCalledOnceWith(true);
  });

  it("can't be closed or sent again while sending", async () => {
    let finish!: () => void;
    sendIntro.and.returnValue(new Promise<void>((resolve) => (finish = resolve)));
    const sheet = create();
    sheet.setPicked(['polyamory']);
    sheet.setText('Hello');

    const sending = sheet.send();
    expect(ref.disableClose).toBeTrue();
    expect(sheet.buttonLabel()).toBe('Sending…');
    await sheet.send();
    expect(sendIntro).toHaveBeenCalledTimes(1);

    finish();
    await sending;
    expect(ref.disableClose).toBeFalse();
  });

  it('stays open with the message kept when sending fails', async () => {
    sendIntro.and.rejectWith(new Error('offline'));
    const sheet = create();
    sheet.setPicked(['polyamory']);
    sheet.setText('Hello');

    await sheet.send();

    expect(sheet.failed()).toBeTrue();
    expect(ref.dismiss).not.toHaveBeenCalled();
    expect(ref.disableClose).toBeFalse();
    expect(sheet.canSend()).toBeTrue();
    expect(storage.has('intro.draft.ivy')).toBeTrue();
  });
});
