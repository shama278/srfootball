# Скрипт для установки Java 17 и настройки Gradle
# Запустите от имени администратора

$JAVA_VERSION = "17"
$JAVA_INSTALL_DIR = "C:\Java\jdk-17"
$JAVA_DOWNLOAD_URL = "https://api.adoptium.net/v3/binary/latest/$JAVA_VERSION/ga/windows/x64/jdk/hotspot/normal/eclipse"

Write-Host "=== Установка Java 17 для Android сборки ===" -ForegroundColor Green
Write-Host ""

# Проверка, установлена ли уже Java 17
$existingJava = Get-ChildItem "C:\Program Files\Eclipse Adoptium" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "jdk-17" } | Select-Object -First 1
if ($existingJava) {
    Write-Host "Java 17 уже установлена: $($existingJava.FullName)" -ForegroundColor Yellow
    $JAVA_INSTALL_DIR = $existingJava.FullName
} else {
    Write-Host "Java 17 не найдена. Выберите способ установки:" -ForegroundColor Yellow
    Write-Host "1. Скачать и установить автоматически (портативная версия)" -ForegroundColor Cyan
    Write-Host "2. Указать путь к уже установленной Java 17" -ForegroundColor Cyan
    Write-Host "3. Пропустить (настроить вручную)" -ForegroundColor Cyan
    Write-Host ""
    $choice = Read-Host "Ваш выбор (1/2/3)"

    if ($choice -eq "1") {
        Write-Host "Скачивание Java 17..." -ForegroundColor Yellow
        $tempZip = "$env:TEMP\jdk-17.zip"
        try {
            # Получаем прямую ссылку на скачивание
            $downloadUrl = "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse"
            Invoke-WebRequest -Uri $downloadUrl -OutFile $tempZip -UseBasicParsing
            Write-Host "Скачивание завершено!" -ForegroundColor Green

            Write-Host "Распаковка..." -ForegroundColor Yellow
            New-Item -ItemType Directory -Force -Path $JAVA_INSTALL_DIR | Out-Null
            Expand-Archive -Path $tempZip -DestinationPath $JAVA_INSTALL_DIR -Force

            # Найти папку jdk внутри
            $jdkFolder = Get-ChildItem $JAVA_INSTALL_DIR -Directory | Where-Object { $_.Name -match "jdk" } | Select-Object -First 1
            if ($jdkFolder) {
                $JAVA_INSTALL_DIR = $jdkFolder.FullName
            }

            Remove-Item $tempZip -Force
            Write-Host "Java 17 установлена в: $JAVA_INSTALL_DIR" -ForegroundColor Green
        } catch {
            Write-Host "Ошибка при скачивании: $_" -ForegroundColor Red
            Write-Host "Скачайте вручную с: https://adoptium.net/temurin/releases/" -ForegroundColor Yellow
            exit 1
        }
    } elseif ($choice -eq "2") {
        $JAVA_INSTALL_DIR = Read-Host "Введите путь к Java 17 (например, C:\Program Files\Eclipse Adoptium\jdk-17.0.12-hotspot)"
        if (-not (Test-Path "$JAVA_INSTALL_DIR\bin\java.exe")) {
            Write-Host "Java не найдена по указанному пути!" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Пропущено. Настройте вручную в android\gradle.properties" -ForegroundColor Yellow
        exit 0
    }
}

# Настройка gradle.properties
Write-Host ""
Write-Host "Настройка gradle.properties..." -ForegroundColor Yellow
$gradleProps = "C:\Users\Admin\Desktop\srfootball\android\gradle.properties"

if (Test-Path $gradleProps) {
    $content = Get-Content $gradleProps -Raw

    # Преобразуем путь для gradle.properties (двойные обратные слеши)
    $javaPathForGradle = $JAVA_INSTALL_DIR.Replace('\', '\\')

    # Проверяем, есть ли уже настройка java.home
    if ($content -match "org\.gradle\.java\.home") {
        Write-Host "Обновление существующей настройки org.gradle.java.home..." -ForegroundColor Yellow
        $pattern = "org\.gradle\.java\.home=.*"
        $replacement = "org.gradle.java.home=$javaPathForGradle"
        $content = $content -replace $pattern, $replacement
    } else {
        Write-Host "Добавление настройки org.gradle.java.home..." -ForegroundColor Yellow
        $newLine = "`n# Указать Java 17 для компиляции Android кода`n"
        $newLine += "org.gradle.java.home=$javaPathForGradle`n"
        $content += $newLine
    }

    Set-Content -Path $gradleProps -Value $content
    Write-Host "gradle.properties обновлен!" -ForegroundColor Green
} else {
    Write-Host "Файл gradle.properties не найден!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Готово! ===" -ForegroundColor Green
Write-Host "Java 17 настроена для использования в Gradle." -ForegroundColor Green
Write-Host "Теперь Gradle будет использовать Java 24 для запуска, но Java 17 для компиляции Android кода." -ForegroundColor Green
Write-Host ""
Write-Host "Попробуйте собрать проект:" -ForegroundColor Yellow
Write-Host "cd android" -ForegroundColor Cyan
Write-Host "gradlew.bat assembleRelease" -ForegroundColor Cyan
