package main

import (
	"encoding/json"
	"strings"
)

var messageCatalogs = func() map[string]map[string]string {
	catalogs := map[string]map[string]string{}
	for _, locale := range []string{"zh-CN", "en"} {
		data, err := assets.ReadFile("frontend/locales/" + locale + ".json")
		if err != nil {
			panic(err)
		}
		var messages map[string]string
		if err = json.Unmarshal(data, &messages); err != nil {
			panic(err)
		}
		catalogs[locale] = messages
	}
	return catalogs
}()

func localizedMessage(locale, key string) string {
	if value := messageCatalogs[locale][key]; value != "" {
		return value
	}
	if value := messageCatalogs["zh-CN"][key]; value != "" {
		return value
	}
	return key
}

// Library errors may wrap an operating-system error. Translate the known prefix
// while preserving the original path and underlying diagnostic.
func localizedError(locale, message string) string {
	if locale != "en" {
		return message
	}
	longest, translated := "", ""
	for key, source := range messageCatalogs["zh-CN"] {
		if strings.HasPrefix(key, "errors.") && !strings.Contains(source, "%") && strings.HasPrefix(message, source) && len(source) > len(longest) {
			longest, translated = source, localizedMessage(locale, key)
		}
	}
	if longest != "" {
		return translated + strings.TrimPrefix(message, longest)
	}
	return message
}
