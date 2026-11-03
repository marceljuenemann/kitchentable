import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Conversation } from '../../../core/connections/connections.model';
import { ConnectionsStore } from '../../../core/connections/connections.store';
import { CommunityComponent, MOODS } from './community.component';

describe('CommunityComponent', () => {
  const team = signal<Conversation | undefined>(undefined);
  let send: jasmine.Spy;

  function create() {
    TestBed.configureTestingModule({
      imports: [CommunityComponent],
      providers: [
        provideRouter([]),
        { provide: ConnectionsStore, useValue: { team, send } },
        { provide: AuthService, useValue: { userId$: of(null) } },
      ],
    });
    const fixture = TestBed.createComponent(CommunityComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    send = jasmine.createSpy('send');
    team.set({ person: { id: 'team' } } as Conversation);
  });

  it('sends the mood to the team with one tap, and again when it changes', () => {
    const community = create().componentInstance;
    community.sendMood(MOODS[4]);
    community.sendMood(MOODS[4]);
    expect(send).toHaveBeenCalledOnceWith('team', 'Feedback submitted: 😍 Love it');

    community.sendMood(MOODS[2]);
    expect(send).toHaveBeenCalledWith('team', 'Feedback submitted: 😐 Okay');
    expect(send).toHaveBeenCalledTimes(2);
    expect(community.mood()).toBe(MOODS[2]);
  });

  it('sends more as its own message, trimmed, and only if there is any', () => {
    const community = create().componentInstance;
    community.sendMood(MOODS[2]);
    community.more.set('  \n ');
    community.sendMore();
    expect(community.moreSent()).toBeFalse();

    community.more.set(' The search could be faster \n');
    community.sendMore();
    expect(send).toHaveBeenCalledWith('team', 'Feedback submitted: The search could be faster');
    expect(community.moreSent()).toBeTrue();
  });

  it('leaves out feedback and reports without a conversation with the team, as for admins', () => {
    team.set(undefined);
    const element: HTMLElement = create().nativeElement;
    const headings = [...element.querySelectorAll('h2')].map((h2) => h2.textContent);
    expect(headings).toEqual(['Invite friends', 'Help build Kitchen Table', 'Open source']);
  });
});
