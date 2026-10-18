// 검사 화면: 목록(무엇) · 도면(어디) · 기록(기준과 결과)
import Drawing from '../../components/Drawing.jsx';
import ItemList from './ItemList.jsx';
import Record from './Record.jsx';

export default function Inspect({ ds, store, selectedRef, onSelect, onNext }) {
  return (
    <div className="inspect">
      <ItemList ds={ds} store={store} selectedRef={selectedRef} onSelect={onSelect} />
      <Drawing ds={ds} store={store} selectedRef={selectedRef} onSelect={onSelect} />
      <Record ds={ds} store={store} refId={selectedRef} onNext={onNext} />
    </div>
  );
}
