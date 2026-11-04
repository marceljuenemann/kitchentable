import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { AnalyticsService } from '../../../core/analytics.service';
import { PhotoStorageService } from '../../../core/photo-storage.service';
import { PhotoGridComponent } from './photo-grid.component';

describe('PhotoGridComponent', () => {
  let fixture: ComponentFixture<PhotoGridComponent>;
  let component: PhotoGridComponent;
  let remove: jasmine.Spy<(id: string) => Promise<void>>;
  let missing: string[];

  const images = () =>
    Array.from(fixture.nativeElement.querySelectorAll('img') as NodeListOf<HTMLImageElement>);
  const error = () => (fixture.nativeElement as HTMLElement).querySelector('.error');

  async function create(photos: string[], stored: Record<string, string | null>) {
    remove = jasmine.createSpy('remove').and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatBottomSheet, useValue: {} },
        { provide: AnalyticsService, useValue: { track: () => undefined } },
        {
          provide: PhotoStorageService,
          useValue: {
            thumbUrls: async (ids: string[]) => new Map(ids.map((id) => [id, stored[id] ?? null])),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(PhotoGridComponent);
    component = fixture.componentInstance;
    missing = [];
    component.missing.subscribe((id) => missing.push(id));
    fixture.componentRef.setInput('photos', photos);
    fixture.componentRef.setInput('remove', remove);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows the stored photos and reports those whose files are gone', async () => {
    await create(['a', 'b'], { a: 'https://storage/a' });

    expect(images().map((image) => image.alt)).toEqual(['Photo 1']);
    expect(missing).toEqual(['b']);
  });

  it('removes through the given function, and says so if that fails', async () => {
    await create(['a'], { a: 'https://storage/a' });

    await component.onRemove('a');
    fixture.detectChanges();
    expect(remove).toHaveBeenCalledWith('a');
    expect(error()).toBeNull();

    remove.and.rejectWith(new Error('offline'));
    await component.onRemove('a');
    fixture.detectChanges();
    expect(error()?.textContent).toContain("couldn't remove that photo");
  });

  it('reports the new order after a drag', async () => {
    const reordered: string[][] = [];
    await create(['a', 'b', 'c'], {});
    component.reordered.subscribe((ids) => reordered.push(ids));

    component.reorder({ previousIndex: 2, currentIndex: 0 } as CdkDragDrop<unknown>);
    component.reorder({ previousIndex: 1, currentIndex: 1 } as CdkDragDrop<unknown>);

    expect(reordered).toEqual([['c', 'a', 'b']]);
  });
});
