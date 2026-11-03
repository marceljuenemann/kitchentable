import { TestBed } from '@angular/core/testing';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { TextSheetComponent, TextSheetData } from './text-sheet.component';

describe('TextSheetComponent', () => {
  let component: TextSheetComponent;
  let dismiss: jasmine.Spy;

  function create(data: Partial<TextSheetData> = {}) {
    TestBed.resetTestingModule();
    dismiss = jasmine.createSpy('dismiss');
    TestBed.configureTestingModule({
      providers: [
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        { provide: MatBottomSheetRef, useValue: { dismiss } },
        {
          provide: MAT_BOTTOM_SHEET_DATA,
          useValue: {
            title: 'Name',
            value: 'Sam',
            placeholder: '',
            ...data,
          } satisfies TextSheetData,
        },
      ],
    });
    const fixture = TestBed.createComponent(TextSheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('closes with the text trimmed', () => {
    create();
    component.value.set('  Alex ');
    component.save();

    expect(dismiss).toHaveBeenCalledOnceWith('Alex');
  });

  it('needs some text unless the field is optional', () => {
    create();
    component.value.set('   ');
    component.save();
    expect(dismiss).not.toHaveBeenCalled();

    create({ optional: true });
    component.value.set('   ');
    component.save();
    expect(dismiss).toHaveBeenCalledOnceWith('');
  });

  it('needs the minimum length, not counting spaces around the text', () => {
    create({ value: '', minLength: 5 });
    component.value.set(' abcd ');
    expect(component.missing()).toBe(1);
    component.save();
    expect(dismiss).not.toHaveBeenCalled();

    component.value.set('abcde');
    component.save();
    expect(dismiss).toHaveBeenCalledOnceWith('abcde');
  });
});
