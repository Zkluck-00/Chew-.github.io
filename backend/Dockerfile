FROM gradle:9.9.1-jdk21 AS build
WORKDIR /app
COPY build.gradle settings.gradle ./
COPY src src
RUN gradle --no-daemon bootJar

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar /app/chew.jar
ENTRYPOINT ["java", "-jar", "/app/chew.jar"]