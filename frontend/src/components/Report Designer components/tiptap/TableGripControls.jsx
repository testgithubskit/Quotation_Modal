import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';

/**
 * Table row/column grips — grey + (left) to add, red × (right) to delete.
 * Uses an expanded hit area so buttons stay visible while clicking.
 */
export default function TableGripControls({ editor }) {
  const [rowCtrl, setRowCtrl] = useState(null);
  const [colCtrl, setColCtrl] = useState(null);
  const pinnedRef = useRef(false);
  const latestRef = useRef({ row: null, col: null });

  useEffect(() => {
    latestRef.current = { row: rowCtrl, col: colCtrl };
  }, [rowCtrl, colCtrl]);

  useEffect(() => {
    if (!editor) return undefined;
    const root = editor.view.dom;

    const isGrip = (el) => Boolean(el?.closest?.('.table-grip-ui'));

    const updateFromPoint = (clientX, clientY, target) => {
      if (!editor.isEditable) return;
      if (pinnedRef.current || isGrip(target)) return;

      const tables = root.querySelectorAll('table');
      let matched = null;

      tables.forEach((table) => {
        const tableRect = table.getBoundingClientRect();
        const padL = 44;
        const padR = 36;
        const padT = 28;
        if (
          clientX < tableRect.left - padL
          || clientX > tableRect.right + padR
          || clientY < tableRect.top - padT
          || clientY > tableRect.bottom + 8
        ) {
          return;
        }

        const rows = Array.from(table.querySelectorAll(':scope > tbody > tr, :scope > tr'));
        let row = null;
        let rowIndex = -1;
        rows.forEach((r, i) => {
          const rr = r.getBoundingClientRect();
          if (clientY >= rr.top && clientY <= rr.bottom) {
            row = r;
            rowIndex = i;
          }
        });
        if (!row && rows.length) {
          // Between rows: pick nearest by Y
          let best = 0;
          let bestDist = Infinity;
          rows.forEach((r, i) => {
            const rr = r.getBoundingClientRect();
            const mid = (rr.top + rr.bottom) / 2;
            const d = Math.abs(clientY - mid);
            if (d < bestDist) {
              bestDist = d;
              best = i;
            }
          });
          row = rows[best];
          rowIndex = best;
        }
        if (!row) return;

        const cells = Array.from(row.querySelectorAll(':scope > td, :scope > th'));
        let cell = cells[0];
        let colIndex = 0;
        cells.forEach((c, i) => {
          const cr = c.getBoundingClientRect();
          if (clientX >= cr.left && clientX <= cr.right) {
            cell = c;
            colIndex = i;
          }
        });

        matched = {
          table,
          tableRect,
          row,
          rowIndex,
          cell,
          colIndex,
          cells,
          rows,
        };
      });

      if (!matched) {
        setRowCtrl(null);
        setColCtrl(null);
        return;
      }

      const {
        tableRect, row, rowIndex, cell, colIndex, cells, rows,
      } = matched;
      const rowRect = row.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();

      const nearLeft = clientX <= tableRect.left + 40;
      const nearRight = clientX >= tableRect.right - 32;
      const nearTop = clientY <= Math.max(tableRect.top + 20, cellRect.top + 14);

      if (nearLeft || nearRight) {
        setRowCtrl({
          top: rowRect.top + rowRect.height / 2,
          left: tableRect.left - 14,
          right: tableRect.right + 8,
          row,
          rowIndex,
          canDelete: rows.length > 1,
        });
      } else {
        setRowCtrl(null);
      }

      if (nearTop) {
        setColCtrl({
          top: tableRect.top - 14,
          left: cellRect.left + cellRect.width / 2,
          cell,
          colIndex,
          canDelete: cells.length > 1,
        });
      } else {
        setColCtrl(null);
      }
    };

    const onMove = (e) => updateFromPoint(e.clientX, e.clientY, e.target);

    document.addEventListener('mousemove', onMove, true);
    return () => {
      document.removeEventListener('mousemove', onMove, true);
    };
  }, [editor]);

  const focusCell = (domNode) => {
    try {
      const pos = editor.view.posAtDOM(domNode, 0);
      editor.chain().focus().setTextSelection(pos).run();
      return true;
    } catch {
      return false;
    }
  };

  const pin = () => {
    pinnedRef.current = true;
  };
  const unpin = () => {
    pinnedRef.current = false;
  };

  const addRow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const row = latestRef.current.row?.row;
    if (row) focusCell(row);
    editor.chain().focus().addRowAfter().run();
    pinnedRef.current = false;
    setRowCtrl(null);
    setColCtrl(null);
  };

  const deleteRow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ctrl = latestRef.current.row;
    if (!ctrl?.canDelete) return;
    if (ctrl.row) focusCell(ctrl.row);
    editor.chain().focus().deleteRow().run();
    pinnedRef.current = false;
    setRowCtrl(null);
    setColCtrl(null);
  };

  const addCol = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = latestRef.current.col?.cell;
    if (cell) focusCell(cell);
    editor.chain().focus().addColumnAfter().run();
    pinnedRef.current = false;
    setColCtrl(null);
  };

  const deleteCol = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ctrl = latestRef.current.col;
    if (!ctrl?.canDelete) return;
    if (ctrl.cell) focusCell(ctrl.cell);
    editor.chain().focus().deleteColumn().run();
    pinnedRef.current = false;
    setColCtrl(null);
  };

  if (!rowCtrl && !colCtrl) return null;

  return createPortal(
    <>
      {rowCtrl ? (
        <>
          <div
            className="table-grip-ui table-grip-row-add"
            style={{
              position: 'fixed',
              top: rowCtrl.top,
              left: rowCtrl.left,
              transform: 'translate(-50%, -50%)',
              zIndex: 80,
              padding: 8,
            }}
            onMouseEnter={pin}
            onMouseLeave={unpin}
            onMouseDown={(e) => e.preventDefault()}
          >
            <button
              type="button"
              className="table-grip-btn table-grip-add"
              title="Add row"
              onClick={addRow}
            >
              <PlusOutlined />
            </button>
          </div>
          {rowCtrl.canDelete ? (
            <div
              className="table-grip-ui table-grip-row-del"
              style={{
                position: 'fixed',
                top: rowCtrl.top,
                left: rowCtrl.right,
                transform: 'translate(0, -50%)',
                zIndex: 80,
                padding: 6,
              }}
              onMouseEnter={pin}
              onMouseLeave={unpin}
              onMouseDown={(e) => e.preventDefault()}
            >
              <button
                type="button"
                className="table-grip-btn table-grip-del"
                title="Delete row"
                onClick={deleteRow}
              >
                <CloseOutlined />
              </button>
            </div>
          ) : null}
        </>
      ) : null}
      {colCtrl ? (
        <div
          className="table-grip-ui table-grip-col"
          style={{
            position: 'fixed',
            top: colCtrl.top,
            left: colCtrl.left,
            transform: 'translate(-50%, -50%)',
            zIndex: 80,
            display: 'flex',
            gap: 4,
            padding: 8,
          }}
          onMouseEnter={pin}
          onMouseLeave={unpin}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="table-grip-btn table-grip-add"
            title="Add column"
            onClick={addCol}
          >
            <PlusOutlined />
          </button>
          {colCtrl.canDelete ? (
            <button
              type="button"
              className="table-grip-btn table-grip-del"
              title="Delete column"
              onClick={deleteCol}
            >
              <CloseOutlined />
            </button>
          ) : null}
        </div>
      ) : null}
    </>,
    document.body,
  );
}
