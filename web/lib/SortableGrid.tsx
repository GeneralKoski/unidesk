import { ReactNode, useEffect, useState } from "react";
import { Col, Row } from "antd";
import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ColProps = { xs?: number; sm?: number; lg?: number };

function readOrder(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function SortableItem({
  id,
  colProps,
  children,
}: {
  id: string;
  colProps: ColProps;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <Col {...colProps}>
      <div
        ref={setNodeRef}
        style={{
          height: "100%",
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
          cursor: "grab",
          touchAction: "manipulation",
        }}
        {...attributes}
        {...listeners}
      >
        {children}
      </div>
    </Col>
  );
}

export default function SortableGrid<T>({
  items,
  getId,
  storageKey,
  renderItem,
  colProps = { xs: 24, sm: 12, lg: 8 },
}: {
  items: T[];
  getId: (item: T) => string;
  storageKey: string;
  renderItem: (item: T) => ReactNode;
  colProps?: ColProps;
}) {
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    setOrder(readOrder(storageKey));
  }, [storageKey]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const byId = new Map(items.map((it) => [getId(it), it]));
  const ordered: T[] = [];
  for (const id of order) {
    const it = byId.get(id);
    if (it) {
      ordered.push(it);
      byId.delete(id);
    }
  }
  for (const it of items) {
    if (byId.has(getId(it))) ordered.push(it);
  }

  const ids = ordered.map(getId);

  const persist = (next: string[]) => {
    setOrder(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    persist(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <Row gutter={[16, 16]}>
          {ordered.map((it) => (
            <SortableItem key={getId(it)} id={getId(it)} colProps={colProps}>
              {renderItem(it)}
            </SortableItem>
          ))}
        </Row>
      </SortableContext>
    </DndContext>
  );
}
