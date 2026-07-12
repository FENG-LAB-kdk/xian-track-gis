<template>
  <div class="app">
    <nav class="nav">
      <router-link to="/map">地图首页</router-link>
      <router-link to="/track">数据分析</router-link>
    </nav>
    <router-view />
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.nav {
  display: flex;
  gap: 20px;
  padding: 10px 20px;
  background: #f5f5f5;
}
.nav a {
  text-decoration: none;
  color: #333;
}
</style>
