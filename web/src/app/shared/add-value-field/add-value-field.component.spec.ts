import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddValueFieldComponent } from './add-value-field.component';

@Component({
  imports: [AddValueFieldComponent],
  template: `<app-add-value-field
    label="Add your own"
    [isDuplicate]="isDuplicate"
    (added)="added.push($event)"
  />`,
})
class HostComponent {
  added: string[] = [];
  isDuplicate = (value: string) => value.toLowerCase() === 'taken';
}

describe('AddValueFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const input = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;
  const addButton = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  const type = (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('cannot add while empty or only spaces', () => {
    expect(addButton().disabled).toBeTrue();

    type('   ');

    expect(addButton().disabled).toBeTrue();
  });

  it('emits the trimmed value and clears itself', () => {
    type('  Running buddies ');
    expect(addButton().disabled).toBeFalse();

    addButton().click();
    fixture.detectChanges();

    expect(fixture.componentInstance.added).toEqual(['Running buddies']);
    expect(input().value).toBe('');
    expect(addButton().disabled).toBeTrue();
  });

  it('adds on Enter too', () => {
    type('Running buddies');

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(fixture.componentInstance.added).toEqual(['Running buddies']);
  });

  it('does not add a duplicate, however it is typed', () => {
    type(' Taken ');
    expect(addButton().disabled).toBeTrue();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(fixture.componentInstance.added).toEqual([]);
  });
});
