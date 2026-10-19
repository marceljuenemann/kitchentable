import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PolicyComponent, PolicyId } from './policy.component';

describe('PolicyComponent', () => {
  function render(policy: PolicyId): ComponentFixture<PolicyComponent> {
    const fixture = TestBed.createComponent(PolicyComponent);
    fixture.componentRef.setInput('policy', policy);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the Terms of Use from Markdown', () => {
    const el: HTMLElement = render('terms').nativeElement;
    expect(el.querySelector('h1')?.textContent).toBe('Kitchen Table Terms of Use');
    expect(el.querySelectorAll('h2').length).toBeGreaterThan(5);
  });

  it('renders the Privacy Policy, including its tables', () => {
    const el: HTMLElement = render('privacy').nativeElement;
    expect(el.querySelector('h1')?.textContent).toBe('Kitchen Table Privacy Policy');
    expect(el.querySelector('table td')).not.toBeNull();
  });

  it('switches documents when the input changes', () => {
    const fixture = render('terms');
    fixture.componentRef.setInput('policy', 'privacy');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toBe('Kitchen Table Privacy Policy');
  });
});
