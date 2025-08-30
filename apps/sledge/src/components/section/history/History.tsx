import { Component } from 'solid-js';
import ProjectHistoryItem from '~/components/section/history/ProjectHistoryItem';

const History: Component = () => {
  return (
    <>
      <ProjectHistoryItem />
      {/* <For each={layerListStore.layers}>{(layer) => <HistoryItem layer={layer} />}</For> */}
    </>
  );
};

export default History;
