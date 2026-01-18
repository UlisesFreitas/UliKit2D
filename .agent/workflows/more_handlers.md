---
description: Add North, South, West, East resize handles to the GizmoManager
---

# More Gizmo Handlers Workflow

This workflow adds the cardinal direction resize handles (Top, Bottom, Left, Right) to the `GizmoManager`.

## 1. Update `HandleType` Definition

Extend the `HandleType` type to include the new directions.

- [ ] Open `src/editor/gizmos/GizmoManager.ts`
- [ ] Add `'n' | 's' | 'w' | 'e'` to the `HandleType` union type.

```typescript
type HandleType = 'center' | 'rotate' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null;
```

## 2. Update `getProjectedPoints`

Calculate the midpoints for the top, bottom, left, and right edges.

- [ ] In `getProjectedPoints`, calculate the local midpoints.
- [ ] Project them to global coordinates.

```typescript
// Inside getProjectedPoints, update localPts:
const localPts = {
    nw: new Point(lb.x, lb.y),
    ne: new Point(lb.x + lb.width, lb.y),
    sw: new Point(lb.x, lb.y + lb.height),
    se: new Point(lb.x + lb.width, lb.y + lb.height),
    // Midpoints
    n: new Point(lb.x + lb.width / 2, lb.y),
    s: new Point(lb.x + lb.width / 2, lb.y + lb.height),
    w: new Point(lb.x, lb.y + lb.height / 2),
    e: new Point(lb.x + lb.width, lb.y + lb.height / 2),
    
    rotate: new Point(lb.x + lb.width / 2, lb.y - 10)
};

// Return object should include them
return {
    nw: displayObject.toGlobal(localPts.nw),
    ne: displayObject.toGlobal(localPts.ne),
    sw: displayObject.toGlobal(localPts.sw),
    se: displayObject.toGlobal(localPts.se),
    n: displayObject.toGlobal(localPts.n),
    s: displayObject.toGlobal(localPts.s),
    w: displayObject.toGlobal(localPts.w),
    e: displayObject.toGlobal(localPts.e),
    rotate: displayObject.toGlobal(localPts.rotate)
};
```

## 3. Update `getHitHandleGlobal`

Add hit detection for the new handles.

```typescript
// Inside getHitHandleGlobal
if (dist(mouse, points.n) < tolerance) return 'n';
if (dist(mouse, points.s) < tolerance) return 's';
if (dist(mouse, points.w) < tolerance) return 'w';
if (dist(mouse, points.e) < tolerance) return 'e';
```

## 4. Update `render` method

Draw the new handles in the `render` method.

```typescript
// Inside render method, after drawing corners:
drawHandle(nw, 'nw');
drawHandle(ne, 'ne');
drawHandle(sw, 'sw');
drawHandle(se, 'se');

const n = this.container.toLocal(pts.n);
const s = this.container.toLocal(pts.s);
const w = this.container.toLocal(pts.w);
const e = this.container.toLocal(pts.e);

drawHandle(n, 'n');
drawHandle(s, 's');
drawHandle(w, 'w');
drawHandle(e, 'e');
```

## 5. Verify Scaling Logic

The existing scaling logic in `handleDragMove` uses `dragHandle.includes('e')`, `includes('n')`, etc.
- `HandleType` 'n' includes 'n', so `dragHandle.includes('n')` is true.
- `HandleType` 'n' does NOT include 'e', so `dragHandle.includes('e')` is false.
This means the existing logic should correctly isolate axis scaling for these new handles without code changes.

```typescript
// Reference check (No change needed)
if (this.dragHandle.includes('e')) { ... } // True for 'ne', 'se', 'e'
else if (this.dragHandle.includes('w')) { ... } // True for 'nw', 'sw', 'w'

if (this.dragHandle.includes('s')) { ... } // True for 'sw', 'se', 's'
else if (this.dragHandle.includes('n')) { ... } // True for 'nw', 'ne', 'n'
```
