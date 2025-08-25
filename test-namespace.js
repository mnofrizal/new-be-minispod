const generateNamespaceTemplate = (userId) => {
  const namespaceName = `user-${userId}`;
  return {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: {
      name: namespaceName,
      labels: {
        "minispod.com/managed": "true",
        "minispod.com/user-id": userId,
        "minispod.com/type": "user-namespace",
      },
      annotations: {
        "minispod.com/created-at": new Date().toISOString(),
        "minispod.com/user-id": userId,
      },
    },
  };
};

const manifest = generateNamespaceTemplate("cmeqv0uu70001vvafq2gyu7j2");
console.log("Generated namespace manifest:");
console.log(JSON.stringify(manifest, null, 2));
