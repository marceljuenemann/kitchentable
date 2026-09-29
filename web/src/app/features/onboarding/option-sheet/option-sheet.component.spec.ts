import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { OptionSheetComponent, OptionSheetData } from './option-sheet.component';

describe('OptionSheetComponent', () => {
  let fixture: ComponentFixture<OptionSheetComponent>;
  let component: OptionSheetComponent;
  let dismiss: jasmine.Spy;

  // The clickable element is the chip's inner action button, not the mat-chip-option host.
  const chip = (label: string) =>
    Array.from(fixture.nativeElement.querySelectorAll('mat-chip-option button')).find((element) =>
      (element as HTMLElement).textContent?.trim().startsWith(label),
    ) as HTMLElement;
  const click = (label: string) => {
    chip(label).click();
    fixture.detectChanges();
  };

  function create(data: Partial<OptionSheetData> = {}) {
    TestBed.resetTestingModule();
    dismiss = jasmine.createSpy('dismiss');
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: MatBottomSheetRef, useValue: { dismiss } },
        {
          provide: MAT_BOTTOM_SHEET_DATA,
          useValue: {
            title: 'Gender',
            help: '',
            options: ['Non-binary', 'Man', 'Woman'],
            selected: [],
            multi: true,
            placeholder: '',
            ...data,
          } satisfies OptionSheetData,
        },
      ],
    });
    fixture = TestBed.createComponent(OptionSheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('multi-select', () => {
    beforeEach(() => create());

    it('orders the selection by when each option was picked, not by its position in the list', () => {
      click('Woman');
      click('Non-binary');

      expect(component.selected()).toEqual(['Woman', 'Non-binary']);
    });

    it('drops a value from its place in the order when it is unselected', () => {
      click('Woman');
      click('Non-binary');
      click('Man');
      click('Non-binary');

      expect(component.selected()).toEqual(['Woman', 'Man']);
    });

    it('puts a re-picked value back at the end, not its old place', () => {
      click('Woman');
      click('Non-binary');
      click('Woman');
      click('Woman');

      expect(component.selected()).toEqual(['Non-binary', 'Woman']);
    });

    it('keeps the order that was already chosen when the sheet is reopened', () => {
      create({ selected: ['Woman', 'Non-binary'] });

      expect(component.selected()).toEqual(['Woman', 'Non-binary']);
    });

    it('appends a custom value at the end of the order, and closes with it on Done', () => {
      click('Woman');
      component.addCustom('Genderfluid');
      component.done();

      expect(component.selected()).toEqual(['Woman', 'Genderfluid']);
      expect(dismiss).toHaveBeenCalledOnceWith(['Woman', 'Genderfluid']);
    });

    it('closes with the selection in pick order', () => {
      click('Man');
      click('Woman');
      component.done();

      expect(dismiss).toHaveBeenCalledOnceWith(['Man', 'Woman']);
    });

    it('clears the order along with the selection', () => {
      click('Woman');
      click('Non-binary');

      component.clear();

      expect(component.selected()).toEqual([]);
    });
  });

  describe('single-select', () => {
    it('closes as soon as an option is picked', () => {
      create({ multi: false });

      click('Man');

      expect(dismiss).toHaveBeenCalledOnceWith(['Man']);
    });
  });
});
