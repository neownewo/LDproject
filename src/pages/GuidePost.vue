<template>
  <section class="card card-pad">
    <div class="badge">Guide</div>
    <h1 class="h1" style="margin-top:10px;">文章：{{ $route.params.slug }}</h1>
    <p style="margin:0; color: var(--muted);">
      之後這裡會改成 Markdown 文章內容 + 目錄 + 內文廣告位。
    </p>

    <div style="height:14px;"></div>

    <div class="card" style="border:1px dashed rgba(255,255,255,.18); background: rgba(255,255,255,.03);">
      <div style="height:140px; display:flex; align-items:center; justify-content:center; color: rgba(233,236,241,.55);">
        Ad Slot (in-article)
      </div>
    </div>
  </section>
</template>
