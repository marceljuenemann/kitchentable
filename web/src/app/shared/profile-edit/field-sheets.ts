import { GENDER_OPTIONS, PRONOUN_OPTIONS, SEXUALITY_OPTIONS } from '../../core/profile-options';
import { OptionSheetData } from './option-sheet/option-sheet.component';

/** How the sheets for editing a profile open (`MatBottomSheet.open()`'s config). */
export const PROFILE_SHEET_CONFIG = {
  panelClass: 'kt-bottom-sheet',
  // Focus the sheet itself rather than its first button (which would be "Clear").
  autoFocus: 'dialog',
} as const;

/** The profile fields picked from a list in an `OptionSheetComponent`. */
export type ListField = 'pronouns' | 'gender' | 'sexuality';

/** The option sheet for each list field; open one with the current values as `selected`. */
export const LIST_FIELD_SHEETS: Record<ListField, Omit<OptionSheetData, 'selected'>> = {
  pronouns: {
    title: 'Pronouns',
    help: "Choose what you'd like to show on your profile.",
    options: PRONOUN_OPTIONS,
    multi: false,
    placeholder: 'e.g. ze/hir',
    accent: 'primary',
  },
  gender: {
    title: 'Gender',
    help: "Choose what you'd like to show on your profile.",
    options: GENDER_OPTIONS,
    multi: true,
    placeholder: 'e.g. Demiboy, Transfeminine',
  },
  sexuality: {
    title: 'Sexuality',
    help: "Choose what you'd like to show on your profile.",
    options: SEXUALITY_OPTIONS,
    multi: true,
    placeholder: 'e.g. Bicurious, Omnisexual',
    accent: 'tertiary',
  },
};
