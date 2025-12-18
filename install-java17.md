# Установка Java 17 для Android сборки

## Способ 1: Через Adoptium (рекомендуется)

1. Перейдите на https://adoptium.net/temurin/releases/
2. Выберите:
   - Version: 17 (LTS)
   - Operating System: Windows
   - Architecture: x64
   - Package Type: JDK
3. Скачайте и установите

## Способ 2: Через Chocolatey (если установлен)

```powershell
choco install openjdk17
```

## Способ 3: Портативная версия (без установки)

1. Скачайте ZIP архив с https://adoptium.net/temurin/releases/
2. Распакуйте в `C:\Java\jdk-17`
3. Установите переменную окружения (см. ниже)

## Настройка после установки

### Вариант A: Установить JAVA_HOME для Gradle (рекомендуется)

Добавьте в `android\gradle.properties`:
```properties
# Указать путь к Java 17 (замените на ваш путь)
org.gradle.java.home=C\:\\Java\\jdk-17
```

### Вариант B: Установить JAVA_HOME системно

1. Откройте "Переменные среды" (Environment Variables)
2. Создайте переменную `JAVA_HOME` = `C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot`
3. Добавьте `%JAVA_HOME%\bin` в `PATH`

### Вариант C: Использовать Java toolchain в build.gradle

После установки Java 17, раскомментируйте настройки toolchain в `android\build.gradle`
