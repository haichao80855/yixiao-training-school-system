<template>
  <nav class="tp-segment" aria-label="学员与班级">
    <RouterLink to="/teacher/students" class="tp-segment-item" :class="{ 'is-active': route.name === 'TeacherStudents' }">学员</RouterLink>
    <RouterLink to="/teacher/classes" class="tp-segment-item" :class="{ 'is-active': route.name === 'TeacherClasses' }">班级</RouterLink>
    <RouterLink to="/teacher/warnings" class="tp-segment-item" :class="{ 'is-active': route.name === 'TeacherWarnings' }">预警</RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>
