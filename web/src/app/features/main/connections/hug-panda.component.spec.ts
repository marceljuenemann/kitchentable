import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HugPandaComponent } from './hug-panda.component';

describe('HugPandaComponent', () => {
  let fixture: ComponentFixture<HugPandaComponent>;

  const panda = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  const hearts = () =>
    fixture.nativeElement.querySelectorAll('.floating-heart') as NodeListOf<SVGElement>;

  beforeEach(() => {
    fixture = TestBed.createComponent(HugPandaComponent);
    fixture.detectChanges();
  });

  it('hugs on a tap and lets go after a moment', fakeAsync(() => {
    const hint = fixture.nativeElement.querySelector('.hint') as HTMLElement;
    expect(hint.classList).not.toContain('gone');

    panda().click();
    fixture.detectChanges();
    expect(panda().classList).toContain('hugging');
    expect(hint.classList).toContain('gone');

    tick(900);
    fixture.detectChanges();
    expect(panda().classList).not.toContain('hugging');
  }));

  it('keeps hugging while tapped again', fakeAsync(() => {
    panda().click();
    tick(600);
    panda().click();
    tick(600);
    fixture.detectChanges();
    expect(panda().classList).toContain('hugging');

    tick(300);
    fixture.detectChanges();
    expect(panda().classList).not.toContain('hugging');
  }));

  it('sends hearts up, each removed when its animation ends', fakeAsync(() => {
    panda().click();
    panda().click();
    fixture.detectChanges();
    expect(hearts().length).toBe(10);

    hearts()[0].dispatchEvent(new Event('animationend'));
    fixture.detectChanges();
    expect(hearts().length).toBe(9);
    tick(900);
  }));
});
